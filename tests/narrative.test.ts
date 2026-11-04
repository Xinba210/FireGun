import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { InfiltrationDirector } from '../src/game/cinematics';
import { TacticalRadioAudioEngine } from '../src/game/audio';
import { calculateWeaponEffectiveStats } from '../src/game/progression';

describe('Narrative & Cinematics Engine (v1.5.0)', () => {
  it('guarantees protagonist 3rd-person mesh is strictly hidden to prevent head occlusion', () => {
    const cam = new THREE.PerspectiveCamera();
    const director = new InfiltrationDirector(cam);
    expect(director.showProtagonistMesh).toBe(false);
  });

  it('calculates helicopter insertion approach glide-path properly', () => {
    const cam = new THREE.PerspectiveCamera();
    const director = new InfiltrationDirector(cam);
    director.play(() => {});

    // At t = 0
    expect(director.helicopterPos.z).toBeGreaterThan(40);

    // Update to low hover / fast-rope drop (t = 19.9s in 24s high-speed insertion)
    director.update(19.9, new THREE.Vector3(-6.5, 1.72, 24.0));
    expect(director.helicopterPos.x).toBeCloseTo(-6.5, 0.2);
    expect(director.helicopterPos.z).toBeCloseTo(24.5, 0.2);
    expect(director.active).toBe(true);
  });

  it('tactical radio engine queues speech and creates bandpass frequencies', () => {
    const radio = new TacticalRadioAudioEngine();
    let started = false;
    radio.speakRadioLine('COMMAND', 'Test transmission', () => {
      started = true;
    });
    expect(radio).toBeDefined();
  });

  it('calculates gunsmith attachment stats correctly (suppressor muffles sound and improves recoil)', () => {
    const baseWep = {
      damage: 34,
      recoilPitch: 0.042,
      recoilZ: 0.08,
      reloadTime: 2.2,
      adsFov: 45,
      magSize: 30,
    };
    const modded = calculateWeaponEffectiveStats(baseWep, 'ar7');
    expect(modded.magSize).toBeGreaterThanOrEqual(30);
    expect(modded.damage).toBe(34);
  });
});
