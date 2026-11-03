import { describe, it, expect } from 'vitest';

export function calculateGyroDelta(
  degRate: number,
  sensitivity = 2.2,
  axisMult = 1.0,
  isAds = false,
  accelThreshold = 12.0
): number {
  const absRate = Math.abs(degRate);
  const sign = Math.sign(degRate);
  // Non-linear acceleration: low speeds remain 1.0x, high speeds above threshold get power-curve boost
  const accelGain = absRate > accelThreshold ? Math.pow(absRate / accelThreshold, 1.35) : 1.0;
  const adsScale = isAds ? 0.65 : 1.0;
  return sign * absRate * sensitivity * axisMult * accelGain * adsScale * (Math.PI / 180);
}

describe('Gyroscope Non-Linear Acceleration & Axis Control', () => {
  it('has default base sensitivity of 2.2', () => {
    const delta = calculateGyroDelta(5.0, 2.2, 1.0, false);
    expect(delta).toBeGreaterThan(0.15);
  });

  it('amplifies high-speed wrist flick much more than linear scaling', () => {
    const slowRate = 4.0;
    const fastRate = 36.0; // 9x speed
    const slowDelta = calculateGyroDelta(slowRate, 2.2, 1.0, false);
    const fastDelta = calculateGyroDelta(fastRate, 2.2, 1.0, false);

    const ratio = fastDelta / slowDelta;
    // With non-linear acceleration gain, 9x speed should yield > 15x angular response
    expect(ratio).toBeGreaterThan(15.0);
  });

  it('keeps ADS sensitivity at 0.65x instead of overly sluggish 0.35x', () => {
    const hipDelta = calculateGyroDelta(10.0, 2.2, 1.0, false);
    const adsDelta = calculateGyroDelta(10.0, 2.2, 1.0, true);
    expect(adsDelta / hipDelta).toBeCloseTo(0.65, 2);
  });

  it('allows independent horizontal (Yaw) and vertical (Pitch) multiplier adjustment', () => {
    const yawDelta = calculateGyroDelta(10.0, 2.2, 1.25, false);
    const pitchDelta = calculateGyroDelta(10.0, 2.2, 0.75, false);
    expect(yawDelta).toBeGreaterThan(pitchDelta);
    expect(yawDelta / pitchDelta).toBeCloseTo(1.25 / 0.75, 2);
  });
});
