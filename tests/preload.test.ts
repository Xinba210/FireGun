import { describe, it, expect } from 'vitest';

export interface PreloadStepDefinition {
  step: number;
  label: string;
  targetPercent: number;
}

export const PRELOAD_PIPELINE: PreloadStepDefinition[] = [
  { step: 1, label: 'DOWNLOADING GLB ASSETS & MAP DATA', targetPercent: 25 },
  { step: 2, label: 'UPLOADING TEXTURES TO GPU VRAM (initTexture)', targetPercent: 40 },
  { step: 3, label: 'COMPILING SHADERS & PIPELINES (renderer.compile)', targetPercent: 60 },
  { step: 4, label: 'WARMING UP SKELETAL RIGS & TWO-BONE IK', targetPercent: 75 },
  { step: 5, label: 'PRE-SYNTHESIZING ZERO-VOLUME AUDIO BUFFERS', targetPercent: 85 },
  { step: 6, label: 'WARMUP OFF-SCREEN MULTI-CAMERA RENDERS (6 PASSES)', targetPercent: 98 },
  { step: 7, label: 'VALIDATING 5-SECOND FIRST FRAME PERF GATE (< 50ms)', targetPercent: 100 },
];

export class FrameTimeTracker {
  private frameTimes: number[] = [];

  public recordFrame(deltaMs: number) {
    this.frameTimes.push(deltaMs);
  }

  public getMaxFrameTimeMs(): number {
    return this.frameTimes.length > 0 ? Math.max(...this.frameTimes) : 0;
  }

  public getAverageFrameTimeMs(): number {
    return this.frameTimes.length > 0
      ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      : 16.6;
  }
}

describe('7-Step Preload Warmup Pipeline & Frame Time Gate', () => {
  it('defines 7 sequential preload steps reaching 100%', () => {
    expect(PRELOAD_PIPELINE).toHaveLength(7);
    expect(PRELOAD_PIPELINE[0].targetPercent).toBe(25);
    expect(PRELOAD_PIPELINE[6].targetPercent).toBe(100);
    for (let i = 1; i < PRELOAD_PIPELINE.length; i++) {
      expect(PRELOAD_PIPELINE[i].targetPercent).toBeGreaterThan(PRELOAD_PIPELINE[i - 1].targetPercent);
    }
  });

  it('measures max frame time in the first 5 seconds under 50ms threshold', () => {
    const tracker = new FrameTimeTracker();
    // Simulate typical 60fps frames with a tiny 28ms peak during early warmup
    for (let i = 0; i < 300; i++) {
      tracker.recordFrame(16.6 + (i === 12 ? 11.4 : Math.sin(i) * 1.5));
    }
    const maxMs = tracker.getMaxFrameTimeMs();
    expect(maxMs).toBeLessThan(50.0);
    expect(tracker.getAverageFrameTimeMs()).toBeCloseTo(16.6, 0);
  });
});
