import { FRAME_RATES } from '../lib/timing';
import type { GlobalConfig } from '../types';

interface Props {
  config: GlobalConfig;
  onChange: (config: GlobalConfig) => void;
}

export default function GlobalSettings({ config, onChange }: Props) {
  const framePeriodMs = 1000 / config.fps;
  const sliceDurationMs = framePeriodMs / config.sliceCount;

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-gray-950 border-b border-gray-800">
      <span className="text-xs font-semibold tracking-widest text-red-500 uppercase">
        LED Sub-frame Camera Calculator
      </span>

      <div className="h-4 w-px bg-gray-700" />

      <label className="flex items-center gap-2 text-xs text-gray-400">
        Frame Rate
        <select
          value={config.fps}
          onChange={(e) => onChange({ ...config, fps: parseFloat(e.target.value) })}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
        >
          {FRAME_RATES.map((fps) => (
            <option key={fps} value={fps}>
              {fps} fps
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs text-gray-400">
        Sub-frames
        <input
          type="number"
          min={1}
          max={64}
          value={config.sliceCount}
          onChange={(e) => {
            const v = Math.max(1, Math.min(64, parseInt(e.target.value) || 1));
            onChange({ ...config, sliceCount: v });
          }}
          className="w-14 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 text-center focus:outline-none focus:border-gray-500"
        />
      </label>

      <div className="h-4 w-px bg-gray-700" />

      <span className="text-xs text-gray-500">
        <span className="text-gray-300">{sliceDurationMs.toFixed(3)}ms</span>
        {' / '}
        <span className="text-gray-400">{framePeriodMs.toFixed(3)}ms</span>
        {' '}
        <span className="text-gray-600">sub-frame / frame</span>
      </span>
    </div>
  );
}
