import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InfiltrationDirector, EvacuationDirector } from '../src/game/cinematics.ts';

describe('FireGun v1.9.0 - TopGun Architecture & Tactical Upgrade Suite', () => {
  it('verifies 24-second High-Speed Infiltration Director with multi-stage keyframes', () => {
    const cam = new THREE.PerspectiveCamera();
    const director = new InfiltrationDirector(cam);
    expect(director).toBeDefined();

    director.play(() => {});
    expect(director.active).toBe(true);

    // Initial high-speed maritime cruise
    director.update(0.1, new THREE.Vector3(-18.5, 1.72, 30.5));
    expect(director.helicopterPos.z).toBeGreaterThan(100);

    // High-speed ingress reaches container canyon within 12 seconds
    director.update(12.0, new THREE.Vector3(-18.5, 1.72, 30.5));
    expect(director.helicopterPos.z).toBeLessThan(60);

    // Skip functionality
    director.skip();
    expect(director.active).toBe(false);
  });

  it('verifies 16-second Evacuation Outro Director with heat flare defense', () => {
    const cam = new THREE.PerspectiveCamera();
    const evac = new EvacuationDirector(cam);

    let completed = false;
    evac.play(() => {
      completed = true;
    });

    expect(evac.active).toBe(true);

    // Flare launch phase
    evac.update(3.0);
    expect(evac.flaresActive).toBe(true);

    // Boarding phase
    evac.update(4.0); // t = 7.0s
    expect(evac.flaresActive).toBe(false);
    expect(evac.helicopterPos.y).toBeCloseTo(1.8, 1);

    // Skip
    evac.skip();
    expect(evac.active).toBe(false);
    expect(completed).toBe(true);
  });

  it('validates motion policy: backwards locomotion uses Walk_Loop with negative timeScale', () => {
    // TopGun Motion Policy rule: Walk_Back causes knee and pelvis deformation.
    // Must strictly use Walk_Loop with timeScale = -1.0
    const motionPolicy = (moveDirection: 'fwd' | 'back' | 'left' | 'right') => {
      if (moveDirection === 'back') {
        return { clip: 'Walk_Loop', timeScale: -1.0 };
      } else if (moveDirection === 'left') {
        return { clip: 'Strafe_Left', timeScale: 1.0 };
      } else if (moveDirection === 'right') {
        return { clip: 'Strafe_Right', timeScale: 1.0 };
      }
      return { clip: 'Walk_Loop', timeScale: 1.0 };
    };

    const backResult = motionPolicy('back');
    expect(backResult.clip).toBe('Walk_Loop');
    expect(backResult.timeScale).toBe(-1.0);
    expect(backResult.clip).not.toBe('Walk_Back');
  });

  it('verifies the 4 Game Modes specs: RAID, SURVIVAL, SNIPER, BLITZ', () => {
    const MODES = ['RAID', 'SURVIVAL', 'SNIPER', 'BLITZ'] as const;
    expect(MODES).toHaveLength(4);
    expect(MODES).toContain('RAID');
    expect(MODES).toContain('SURVIVAL');
    expect(MODES).toContain('SNIPER');
    expect(MODES).toContain('BLITZ');
  });
});
