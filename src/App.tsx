import { useMemo, useState, useCallback } from 'react';
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
};

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function App() {
  const [global, setGlobal] = useState<GlobalConfig>(DEFAULT_GLOBAL);
  const [cameras, setCameras] = useState<CameraConfig[]>([]);

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
    const defaultCapture = Math.max(1, Math.floor(global.sliceCount / 4));
    const defaultClose = Math.min(global.sliceCount, defaultCapture + Math.floor(global.sliceCount / 2));

    const newCam: CameraConfig = {
      id: makeId(),
      name: `Camera ${n}`,
      color,
      type: 'komodo',
      captureSlices: defaultCapture,
      closeSlice: defaultClose,
      expanded: true,
      offsetMethod: 'red-sensor',
      evertzFormatId: bestEvertzFormatId(global.fps),
    };
    setCameras((prev) => [...prev, newCam]);
  }, [cameras, global]);

  const handleAddSlice = useCallback(() => {
    setGlobal((prev) => {
      const next = Math.min(64, prev.sliceCount + 1);
      return { ...prev, sliceCount: next };
    });
  }, []);

  const handleDeleteSlice = useCallback(
    (_index: number) => {
      setGlobal((prev) => {
        const next = Math.max(1, prev.sliceCount - 1);
        const updated = { ...prev, sliceCount: next };
        // Clamp camera close slices to new max
        setCameras((cams) =>
          cams.map((c) => ({
            ...c,
            closeSlice: Math.min(c.closeSlice, next),
            captureSlices: Math.min(c.captureSlices, next),
          }))
        );
        return updated;
      });
    },
    []
  );

  const handleGlobalChange = useCallback((cfg: GlobalConfig) => {
    setGlobal(cfg);
    // Clamp camera values when slice count changes
    if (cfg.sliceCount !== global.sliceCount) {
      setCameras((cams) =>
        cams.map((c) => ({
          ...c,
          closeSlice: Math.min(c.closeSlice, cfg.sliceCount),
          captureSlices: Math.min(c.captureSlices, cfg.sliceCount),
        }))
      );
    }
  }, [global.sliceCount]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">
      <GlobalSettings config={global} onChange={handleGlobalChange} />

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
        <TimingPanel global={global} cameras={cameras} timingsMap={timingsMap} />
      </div>
    </div>
  );
}
