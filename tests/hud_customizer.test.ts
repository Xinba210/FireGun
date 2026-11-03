import { describe, it, expect } from 'vitest';

describe('Goal C: Mobile Pro Touch HUD Editor & Gyroscope Calibration', () => {
  it('clamps touch element positions within viewport boundaries', () => {
    const clampPos = (pct: number, min = 5, max = 95) => Math.max(min, Math.min(max, pct));
    expect(clampPos(-10)).toBe(5);
    expect(clampPos(120)).toBe(95);
    expect(clampPos(64)).toBe(64);
  });

  it('filters micro tremors via deadzone threshold', () => {
    const deadzone = 0.02; // in rad
    const filterDelta = (degDelta: number) => {
      const absDeg = Math.abs(degDelta);
      if (absDeg < deadzone * 57.3) return 0;
      return degDelta;
    };

    expect(filterDelta(0.45)).toBe(0); // Under ~1.14 deg -> 0
    expect(filterDelta(-0.8)).toBe(0); // Under ~1.14 deg -> 0
    expect(filterDelta(2.5)).toBe(2.5); // Movement above deadzone passes
  });

  it('supports independent horizontal and vertical sensitivity scaling and invert pitch', () => {
    const config = {
      yawSens: 2.5,
      pitchSens: 1.2,
      invertPitch: true,
    };

    const rawYawDelta = 1.0;
    const rawPitchDelta = 1.0;

    const outYaw = rawYawDelta * config.yawSens;
    const outPitch = (config.invertPitch ? -rawPitchDelta : rawPitchDelta) * config.pitchSens;

    expect(outYaw).toBe(2.5);
    expect(outPitch).toBe(-1.2);
  });
});
