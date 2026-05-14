import { useRef, useState, useLayoutEffect, useEffect, useMemo } from 'react';
import type { CameraConfig, GlobalConfig, CameraTimings } from '../types';
import { sliceStartMs } from '../lib/timing';
import CameraRow from './CameraRow';

const CELL_W      = 56;
const HDR_H       = 36;
const TIME_H      = 28;
const LABEL_H     = 18;
const LABEL_W     = 220;
const ADD_BTN_W   = 40;
const GHOST_SEP_W = 3;
const GHOST_BG    = '#0c0f18';
const SEP_COLOR   = '#1e2236';
const GHOST_BORD  = '#111520';
const MAX_GHOST   = 5;

interface Props {
  global: GlobalConfig;
  cameras: CameraConfig[];
  timingsMap: Record<string, CameraTimings>;
  onUpdateCamera: (camera: CameraConfig) => void;
  onDeleteCamera: (id: string) => void;
  onAddSlice: (afterIndex: number) => void;
  onDeleteSlice: (index: number) => void;
  onAddCamera: () => void;
}

export default function SliceGrid({
  global,
  cameras,
  timingsMap,
  onUpdateCamera,
  onDeleteCamera,
  onAddSlice,
  onDeleteSlice,
  onAddCamera,
}: Props) {
  const sliceDurationMs = (1000 / global.fps) / global.sliceCount;

  const [viewportW, setViewportW] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (gridRef.current) setViewportW(gridRef.current.clientWidth);
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    const observer = new ResizeObserver(() => {
      if (gridRef.current) setViewportW(gridRef.current.clientWidth);
    });
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, []);

  // How many ghost sub-frames fit on each side? Capped at MAX_GHOST and sliceCount;
  // forces the cap (scroll mode) if fewer than 2 fit.
  const ghostCount = useMemo(() => {
    const cap = Math.min(MAX_GHOST, global.sliceCount);
    if (viewportW === 0) return cap;
    const currentW = global.sliceCount * CELL_W;
    const overhead = LABEL_W + 2 * GHOST_SEP_W + ADD_BTN_W;
    const available = viewportW - overhead - currentW;
    const fits = Math.floor(available / (2 * CELL_W));
    if (fits >= 2) return Math.min(cap, fits);
    return cap;
  }, [viewportW, global.sliceCount]);

  const currentW = global.sliceCount * CELL_W;

  return (
    <div ref={gridRef} className="overflow-x-auto overflow-y-auto flex-1">

      {/* ── Sticky header (frame labels + SF numbers) ── */}
      <div className="sticky top-0 z-20 bg-gray-950">

        {/* Frame label row */}
        <div className="flex" style={{ minWidth: '100%' }}>
          <div className="flex-shrink-0 sticky left-0 z-30 bg-gray-950" style={{ width: LABEL_W, height: LABEL_H }} />
          <div style={{ flexGrow: 1, height: LABEL_H }} />
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: ghostCount * CELL_W, height: LABEL_H, backgroundColor: GHOST_BG }}
          >
            <span className="text-gray-700 tracking-widest uppercase" style={{ fontSize: 9 }}>Previous</span>
          </div>
          <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: LABEL_H, backgroundColor: SEP_COLOR }} />
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: currentW, height: LABEL_H }}
          >
            <span className="text-gray-500 tracking-widest uppercase" style={{ fontSize: 9 }}>Current</span>
          </div>
          <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: LABEL_H, backgroundColor: SEP_COLOR }} />
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{ width: ghostCount * CELL_W, height: LABEL_H, backgroundColor: GHOST_BG }}
          >
            <span className="text-gray-700 tracking-widest uppercase" style={{ fontSize: 9 }}>Next</span>
          </div>
          <div style={{ flexGrow: 1, height: LABEL_H }} />
          <div className="flex-shrink-0 sticky right-0 z-20 bg-gray-950" style={{ width: ADD_BTN_W, height: LABEL_H }} />
        </div>

        {/* SF number row */}
        <div className="flex border-b border-gray-800" style={{ minWidth: '100%' }}>
          <div
            className="flex-shrink-0 sticky left-0 z-30 bg-gray-950 flex items-center px-3 border-r border-gray-800 text-xs text-gray-500"
            style={{ width: LABEL_W, height: HDR_H }}
          >
            Sub-frame
          </div>

          <div style={{ flexGrow: 1, height: HDR_H, backgroundColor: GHOST_BG }} />

          {/* Ghost leader SF numbers (last N of previous) */}
          {Array.from({ length: ghostCount }, (_, i) => {
            const sfNum = global.sliceCount - ghostCount + i + 1;
            return (
              <div
                key={`lh${i}`}
                className="flex-shrink-0 flex items-center justify-center border-l text-xs text-gray-700"
                style={{ width: CELL_W, height: HDR_H, backgroundColor: GHOST_BG, borderColor: GHOST_BORD }}
              >
                {sfNum}
              </div>
            );
          })}
          <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: HDR_H, backgroundColor: SEP_COLOR }} />

          {/* Current SF numbers */}
          {Array.from({ length: global.sliceCount }, (_, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex flex-col items-center justify-center border-l border-gray-800 text-xs text-gray-400"
              style={{ width: CELL_W, height: HDR_H }}
            >
              {i + 1}
            </div>
          ))}

          <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: HDR_H, backgroundColor: SEP_COLOR }} />
          {/* Ghost trailer SF numbers (first N of next) */}
          {Array.from({ length: ghostCount }, (_, i) => (
            <div
              key={`th${i}`}
              className="flex-shrink-0 flex items-center justify-center border-l text-xs text-gray-700"
              style={{ width: CELL_W, height: HDR_H, backgroundColor: GHOST_BG, borderColor: GHOST_BORD }}
            >
              {i + 1}
            </div>
          ))}

          <div style={{ flexGrow: 1, height: HDR_H, backgroundColor: GHOST_BG }} />

          {/* Sticky-right add-slice button */}
          <div
            className="flex-shrink-0 sticky right-0 z-20 flex items-center justify-center border-l border-gray-800 bg-gray-950"
            style={{ width: ADD_BTN_W, height: HDR_H }}
          >
            <button
              onClick={() => onAddSlice(global.sliceCount)}
              className="text-gray-600 hover:text-gray-300 text-sm leading-none px-1"
              title="Add sub-frame"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ── Timing row ── */}
      <div className="flex bg-gray-950 border-b border-gray-800" style={{ minWidth: '100%' }}>
        <div
          className="flex-shrink-0 sticky left-0 z-10 bg-gray-950 flex items-center px-3 border-r border-gray-800"
          style={{ width: LABEL_W, height: TIME_H }}
        >
          <span className="text-xs text-gray-500">
            <span className="text-gray-300">{sliceDurationMs.toFixed(3)}ms</span>
            <span className="text-gray-700"> / </span>
            <span className="text-gray-600">{(1000 / global.fps).toFixed(3)}ms</span>
          </span>
        </div>

        <div style={{ flexGrow: 1, height: TIME_H, backgroundColor: GHOST_BG }} />

        {Array.from({ length: ghostCount }, (_, i) => (
          <div
            key={`lt${i}`}
            className="flex-shrink-0"
            style={{ width: CELL_W, height: TIME_H, backgroundColor: GHOST_BG, borderLeft: `1px solid ${GHOST_BORD}` }}
          />
        ))}
        <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: TIME_H, backgroundColor: SEP_COLOR }} />

        {Array.from({ length: global.sliceCount }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 flex items-center justify-center border-l border-gray-800"
            style={{ width: CELL_W, height: TIME_H }}
          >
            <span className="text-xs text-gray-600">{sliceStartMs(i + 1, sliceDurationMs).toFixed(3)}</span>
          </div>
        ))}

        <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: TIME_H, backgroundColor: SEP_COLOR }} />
        {Array.from({ length: ghostCount }, (_, i) => (
          <div
            key={`tt${i}`}
            className="flex-shrink-0"
            style={{ width: CELL_W, height: TIME_H, backgroundColor: GHOST_BG, borderLeft: `1px solid ${GHOST_BORD}` }}
          />
        ))}

        <div style={{ flexGrow: 1, height: TIME_H, backgroundColor: GHOST_BG }} />
        <div className="flex-shrink-0 sticky right-0 z-10 bg-gray-950" style={{ width: ADD_BTN_W, height: TIME_H }} />
      </div>

      {/* ── Camera rows ── */}
      {cameras.map((cam) => (
        <CameraRow
          key={cam.id}
          camera={cam}
          global={global}
          timings={timingsMap[cam.id]}
          ghostCount={ghostCount}
          onUpdate={onUpdateCamera}
          onDelete={() => onDeleteCamera(cam.id)}
        />
      ))}

      {/* ── Add camera row ── */}
      <div className="flex border-t border-gray-800" style={{ minWidth: '100%' }}>
        <div
          className="flex-shrink-0 sticky left-0 z-10 bg-gray-950 border-r border-gray-800 flex items-center px-3"
          style={{ width: LABEL_W, height: 36 }}
        >
          <button
            onClick={onAddCamera}
            className="text-xs text-gray-500 hover:text-gray-200 flex items-center gap-1.5 transition-colors"
          >
            <span className="text-base leading-none">+</span> Add Camera
          </button>
        </div>
        <div style={{ flexGrow: 1, height: 36 }} />
      </div>

      {/* ── Delete slice row ── */}
      <div className="flex border-t border-gray-800 bg-gray-950" style={{ minWidth: '100%' }}>
        <div
          className="flex-shrink-0 sticky left-0 z-10 bg-gray-950 border-r border-gray-800"
          style={{ width: LABEL_W, height: 32 }}
        />

        <div style={{ flexGrow: 1, height: 32, backgroundColor: GHOST_BG }} />

        {Array.from({ length: ghostCount }, (_, i) => (
          <div
            key={`ld${i}`}
            className="flex-shrink-0"
            style={{ width: CELL_W, height: 32, backgroundColor: GHOST_BG, borderLeft: `1px solid ${GHOST_BORD}` }}
          />
        ))}
        <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: 32, backgroundColor: SEP_COLOR }} />

        {Array.from({ length: global.sliceCount }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 flex items-center justify-center border-l border-gray-800"
            style={{ width: CELL_W, height: 32 }}
          >
            <button
              onClick={() => onDeleteSlice(i)}
              className="text-gray-700 hover:text-red-400 text-xs transition-colors"
              title={`Delete sub-frame ${i + 1}`}
              disabled={global.sliceCount <= 1}
            >
              ⌫
            </button>
          </div>
        ))}

        <div className="flex-shrink-0" style={{ width: GHOST_SEP_W, height: 32, backgroundColor: SEP_COLOR }} />
        {Array.from({ length: ghostCount }, (_, i) => (
          <div
            key={`td${i}`}
            className="flex-shrink-0"
            style={{ width: CELL_W, height: 32, backgroundColor: GHOST_BG, borderLeft: `1px solid ${GHOST_BORD}` }}
          />
        ))}

        <div style={{ flexGrow: 1, height: 32, backgroundColor: GHOST_BG }} />
        <div className="flex-shrink-0 sticky right-0 z-10 bg-gray-950" style={{ width: ADD_BTN_W, height: 32 }} />
      </div>
    </div>
  );
}
