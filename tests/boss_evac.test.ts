import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { EvacuationDirector } from '../src/game/cinematics.ts';

describe('Goal B: Boss Encounter & Evacuation Director', () => {
  it('EvacuationDirector tracks allied stealth helicopter approach and climb out', () => {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const evac = new EvacuationDirector(cam);

    let completed = false;
    evac.play(() => {
      completed = true;
    });

    expect(evac.active).toBe(true);

    // Initial phase (touchdown at helipad)
    evac.update(1.0);
    expect(evac.helicopterPos.y).toBeLessThan(12);
    expect(evac.helicopterPos.y).toBeGreaterThanOrEqual(1.8);

    // Mid phase (player boarding)
    evac.update(1.5); // t = 2.5s
    expect(evac.helicopterPos.y).toBeCloseTo(1.8, 1);

    // Climb out phase into storm
    evac.update(2.0); // t = 4.5s
    expect(evac.helicopterPos.y).toBeGreaterThan(5.0);
    expect(evac.helicopterPitch).toBeLessThan(0); // Nose pitched down for forward speed

    // Finish
    evac.update(1.5); // t = 6.0s >= 5.5s
    expect(evac.active).toBe(false);
    expect(completed).toBe(true);
  });

  it('EvacuationDirector skip method completes sequence immediately', () => {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const evac = new EvacuationDirector(cam);

    let done = false;
    evac.play(() => {
      done = true;
    });

    expect(evac.active).toBe(true);
    evac.skip();
    expect(evac.active).toBe(false);
    expect(done).toBe(true);
  });
});
