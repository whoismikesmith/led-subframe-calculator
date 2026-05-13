import type { CameraConfig, GlobalConfig, CameraTimings } from '../types';
import { sliceStartMs } from '../lib/timing';
import CameraRow from './CameraRow';

const CELL_W = 56;
const HDR_H = 36;
const TIME_H = 28;
const LABEL_W = 220;

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

  return (
    <div className="overflow-x-auto overflow-y-auto flex-1">
      {/* ── Column header row ── */}
      <div className="flex min-w-max sticky top-0 z-20 bg-gray-950 border-b border-gray-800">
        {/* Label column header */}
        <div
          className="flex-shrink-0 sticky left-0 z-30 bg-gray-950 flex items-center px-3 border-r border-gray-800 text-xs text-gray-500"
          style={{ width: LABEL_W, height: HDR_H }}
        >
          Sub-frame
        </div>

        {/* Slice number headers */}
        {Array.from({ length: global.sliceCount }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 flex flex-col items-center justify-center border-l border-gray-800 text-xs text-gray-400"
            style={{ width: CELL_W, height: HDR_H }}
          >
            {i + 1}
          </div>
        ))}

        {/* Add slice column header */}
        <div
          className="flex-shrink-0 flex items-center justify-center border-l border-gray-800"
          style={{ width: 40, height: HDR_H }}
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

      {/* ── Timing labels row ── */}
      <div className="flex min-w-max bg-gray-950 border-b border-gray-800">
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

        {Array.from({ length: global.sliceCount }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 flex items-center justify-center border-l border-gray-800"
            style={{ width: CELL_W, height: TIME_H }}
          >
            <span className="text-xs text-gray-600">{sliceStartMs(i + 1, sliceDurationMs).toFixed(3)}</span>
          </div>
        ))}

        <div className="flex-shrink-0" style={{ width: 40, height: TIME_H }} />
      </div>

      {/* ── Camera rows ── */}
      {cameras.map((cam) => (
        <CameraRow
          key={cam.id}
          camera={cam}
          global={global}
          timings={timingsMap[cam.id]}
          onUpdate={onUpdateCamera}
          onDelete={() => onDeleteCamera(cam.id)}
        />
      ))}

      {/* ── Add camera row ── */}
      <div className="flex min-w-max border-t border-gray-800">
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
        <div className="flex-1" style={{ height: 36 }} />
      </div>

      {/* ── Delete slice row ── */}
      <div className="flex min-w-max border-t border-gray-800 bg-gray-950">
        {/* Undo/redo stub */}
        <div
          className="flex-shrink-0 sticky left-0 z-10 bg-gray-950 border-r border-gray-800 flex items-center gap-2 px-3"
          style={{ width: LABEL_W, height: 32 }}
        />

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

        <div className="flex-shrink-0" style={{ width: 40, height: 32 }} />
      </div>
    </div>
  );
}
