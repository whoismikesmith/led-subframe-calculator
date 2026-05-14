/**
 * Evertz 5601 MSC (and 5600 MSC family) genlock offset model.
 *
 * The per-output sync phase offset has three tiers (Vert phase / Hor phase / Fine phase),
 * all referenced to the FULL raster including blanking (SMPTE ST 274 / ST 296):
 *
 *   V (lines)   = complete horizontal lines from frame start (0-indexed, 0 to totalLines-1)
 *   H (samples) = complete samples from start of that line (0-indexed, 0 to samplesPerLine-1)
 *   Fine%       = sub-sample fraction as percentage (0.0% for integer-sample targets)
 *
 * The clock is derived from the format:  clockHz = fps × samplesPerLine × totalLines
 * This works for fractional rates (23.976 = 24000/1001) automatically.
 *
 * Confirmed empirically: 10ms offset at 1080p/50 → V=562, H=1320, Fine=0.0%
 */

export interface EvertzFormat {
  id: string;
  name: string;
  totalLines: number;
  samplesPerLine: number;
  fps: number;
}

export const EVERTZ_FORMATS: EvertzFormat[] = [
  // ── 1080p (SMPTE ST 274) — 1125 total lines including blanking ───────────
  { id: '1080p2398', name: '1080p / 23.98',  totalLines: 1125, samplesPerLine: 2750, fps: 23.976  },
  { id: '1080p24',   name: '1080p / 24',     totalLines: 1125, samplesPerLine: 2750, fps: 24      },
  { id: '1080p25',   name: '1080p / 25',     totalLines: 1125, samplesPerLine: 2640, fps: 25      },
  { id: '1080p2997', name: '1080p / 29.97',  totalLines: 1125, samplesPerLine: 2200, fps: 29.97   },
  { id: '1080p30',   name: '1080p / 30',     totalLines: 1125, samplesPerLine: 2200, fps: 30      },
  { id: '1080p4795', name: '1080p / 47.95',  totalLines: 1125, samplesPerLine: 2750, fps: 47.952  },
  { id: '1080p48',   name: '1080p / 48',     totalLines: 1125, samplesPerLine: 2750, fps: 48      },
  { id: '1080p50',   name: '1080p / 50',     totalLines: 1125, samplesPerLine: 2640, fps: 50      },
  { id: '1080p5994', name: '1080p / 59.94',  totalLines: 1125, samplesPerLine: 2200, fps: 59.94   },
  { id: '1080p60',   name: '1080p / 60',     totalLines: 1125, samplesPerLine: 2200, fps: 60      },
  { id: '1080p11988',name: '1080p / 119.88', totalLines: 1125, samplesPerLine: 2200, fps: 119.88  },
  { id: '1080p120',  name: '1080p / 120',    totalLines: 1125, samplesPerLine: 2200, fps: 120     },
  // ── 720p (SMPTE ST 296) — 750 total lines including blanking ─────────────
  { id: '720p24',    name: '720p / 24',      totalLines: 750,  samplesPerLine: 4125, fps: 24      },
  { id: '720p25',    name: '720p / 25',      totalLines: 750,  samplesPerLine: 3960, fps: 25      },
  { id: '720p30',    name: '720p / 30',      totalLines: 750,  samplesPerLine: 3300, fps: 30      },
  { id: '720p50',    name: '720p / 50',      totalLines: 750,  samplesPerLine: 1980, fps: 50      },
  { id: '720p5994',  name: '720p / 59.94',   totalLines: 750,  samplesPerLine: 1650, fps: 59.94   },
  { id: '720p60',    name: '720p / 60',      totalLines: 750,  samplesPerLine: 1650, fps: 60      },
];

export interface EvertzOffsetResult {
  vLines: number;         // V — complete lines from frame start (0-indexed, enter as Vert phase)
  hSamples: number;       // H — complete samples within that line (0-indexed, enter as Hor phase)
  pixelPeriodNs: number;  // nanoseconds per sample clock
  linePeriodUs: number;   // microseconds per H-line
  framePeriodMs: number;  // milliseconds per frame (sanity: should equal 1000/fps)
  actualOffsetMs: number; // offset after rounding to nearest sample
  roundingErrorNs: number;
}

export function calculateEvertzOffset(
  offsetMs: number,
  format: EvertzFormat
): EvertzOffsetResult {
  const clockHz = format.fps * format.samplesPerLine * format.totalLines;
  const pixelPeriodMs = 1000 / clockHz;
  const linePeriodMs = format.samplesPerLine * pixelPeriodMs;
  const framePeriodMs = format.totalLines * linePeriodMs;

  const totalPixels = Math.round(offsetMs / pixelPeriodMs);

  const totalLines = Math.floor(totalPixels / format.samplesPerLine);
  const vLines  = totalLines % format.totalLines;
  const hSamples = totalPixels % format.samplesPerLine;

  const actualOffsetMs   = totalPixels * pixelPeriodMs;
  const roundingErrorNs  = (offsetMs - actualOffsetMs) * 1_000_000;

  return {
    vLines,
    hSamples,
    pixelPeriodNs:  pixelPeriodMs  * 1_000_000,
    linePeriodUs:   linePeriodMs   * 1_000,
    framePeriodMs,
    actualOffsetMs,
    roundingErrorNs,
  };
}

/** Pick the best 1080p format for a given global fps (prefer 1125-line raster). */
export function bestEvertzFormatId(fps: number): string {
  const preferred = EVERTZ_FORMATS.find(
    (f) => f.totalLines === 1125 && Math.abs(f.fps - fps) < 0.02
  );
  return preferred?.id ?? '1080p24';
}
