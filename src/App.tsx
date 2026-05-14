import { useMemo, useState, useCallback, useEffect } from 'react';
import type { CameraConfig, GlobalConfig } from './types';
import { calculateTimings } from './lib/timing';
import { nextColor } from './lib/cameras';
import { bestEvertzFormatId } from './lib/evertz';
import GlobalSettings from './components/GlobalSettings';
import SliceGrid from './components/SliceGrid';
import TimingPanel from './components/TimingPanel';

const DEFAULT_GLOBAL: GlobalConfig = {
  fps: 24,
  sliceCount: 20,
  evertzFormatId: bestEvertzFormatId(24),
};

const STORAGE_KEY = 'ghostframe-rcp2';

function loadSaved(): { global: GlobalConfig; cameras: CameraConfig[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const sliceCount = data.global?.sliceCount ?? DEFAULT_GLOBAL.sliceCount;
    const fps = data.global?.fps ?? DEFAULT_GLOBAL.fps;
    const firstCam = data.cameras?.[0];

    const global: GlobalConfig = {
      fps,
      sliceCount,
      // Prefer global.evertzFormatId; fall back to first camera's format; then default
      evertzFormatId:
        data.global?.evertzFormatId ??
        firstCam?.evertzFormatId ??
        bestEvertzFormatId(fps),
    };

    // Migrate cameras: strip evertzFormatId (now global), convert captureSlices → shutterAngleDeg
    const cameras = (data.cameras ?? []).map((c: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { evertzFormatId: _ef, captureSlices, ...rest } = c;
      if (rest.shutterAngleDeg === undefined && captureSlices !== undefined) {
        return {
          ...rest,
          shutterAngleDeg: (captureSlices / sliceCount) * 360,
          shutterMode: 'angle' as const,
          offsetMethod: rest.offsetMethod ?? 'red-sensor',
        };
      }
      return { offsetMethod: 'red-sensor', ...rest };
    });

    return { global, cameras };
  } catch {
    return null;
  }
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const [global, setGlobal] = useState<GlobalConfig>(() => loadSaved()?.global ?? DEFAULT_GLOBAL);
  const [cameras, setCameras] = useState<CameraConfig[]>(() => loadSaved()?.cameras ?? []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ global, cameras }));
    } catch {}
  }, [global, cameras]);

  const timingsMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof calculateTimings>> = {};
    for (const cam of cameras) {
      map[cam.id] = calculateTimings(global, cam);
    }
    return map;
  }, [global, cameras]);

  const handleUpdateCamera = useCallback((updated: CameraConfig) => {
    setCameras((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  const handleDeleteCamera = useCallback((id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleAddCamera = useCallback(() => {
    const usedColors = cameras.map((c) => c.color);
    const color = nextColor(usedColors);
    const n = cameras.length + 1;

    const newCam: CameraConfig = {
      id: makeId(),
      name: `Camera ${n}`,
      color,
      type: 'komodo',
      shutterAngleDeg: 180,
      shutterMode: 'angle',
      closeSlice: global.sliceCount,
      expanded: true,
      offsetMethod: 'red-sensor',
    };
    setCameras((prev) => [...prev, newCam]);
  }, [cameras, global]);

  const handleGlobalChange = useCallback((cfg: GlobalConfig) => {
    setGlobal(cfg);
    if (cfg.sliceCount !== global.sliceCount) {
      setCameras((cams) =>
        cams.map((c) => ({
          ...c,
          closeSlice: Math.min(c.closeSlice, cfg.sliceCount),
        }))
      );
    }
  }, [global.sliceCount]);

  const handleAddSlice = useCallback(() => {
    setGlobal((prev) => ({ ...prev, sliceCount: Math.min(64, prev.sliceCount + 1) }));
  }, []);

  const handleDeleteSlice = useCallback((_index: number) => {
    setGlobal((prev) => {
      const next = Math.max(1, prev.sliceCount - 1);
      setCameras((cams) =>
        cams.map((c) => ({ ...c, closeSlice: Math.min(c.closeSlice, next) }))
      );
      return { ...prev, sliceCount: next };
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <GlobalSettings />

      <div className="flex flex-1 min-h-0">
        <SliceGrid
          global={global}
          cameras={cameras}
          timingsMap={timingsMap}
          onUpdateCamera={handleUpdateCamera}
          onDeleteCamera={handleDeleteCamera}
          onAddSlice={handleAddSlice}
          onDeleteSlice={handleDeleteSlice}
          onAddCamera={handleAddCamera}
        />
        <TimingPanel
          global={global}
          cameras={cameras}
          timingsMap={timingsMap}
          onGlobalChange={handleGlobalChange}
        />
      </div>
    </div>
  );
}
