import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  loadProgression,
  saveProgression,
  equipAttachment,
  unequipAttachment,
  calculateWeaponEffectiveStats,
  getAttachmentComparison,
  getDefaultProgression,
} from '../src/game/progression.ts';
import { WeaponsAttachmentVisualizer } from '../src/game/weapons.ts';

describe('Goal A: 3D Gunsmith Interactive Workbench', () => {
  beforeEach(() => {
    saveProgression(getDefaultProgression());
  });

  it('calculates real-time attachment stat deltas accurately', () => {
    // Equipping compensator (muzzle_brake) should reduce recoil
    const delta = getAttachmentComparison('ar7', 'muzzle', 'muzzle_brake');
    expect(delta.recoilDeltaPct).toBeLessThan(0); // Lower recoil is better
    expect(delta.isSilenced).toBe(false);

    // Equipping silencer should mark silenced and reduce damage slightly
    const silDelta = getAttachmentComparison('ar7', 'muzzle', 'muzzle_silencer');
    expect(silDelta.isSilenced).toBe(true);
    expect(silDelta.damageDelta).toBeLessThan(0);

    // Extended mag should increase capacity
    const magDelta = getAttachmentComparison('ar7', 'mag', 'mag_extended');
    expect(magDelta.magDelta).toBeGreaterThanOrEqual(12);
  });

  it('equips and unequips attachments in progression state', () => {
    const success = equipAttachment('ar7', 'muzzle_silencer');
    expect(success).toBe(true);

    const p1 = loadProgression();
    expect(p1.weapons['ar7'].equippedAttachments.muzzle).toBe('muzzle_silencer');

    unequipAttachment('ar7', 'muzzle');
    const p2 = loadProgression();
    expect(p2.weapons['ar7'].equippedAttachments.muzzle).toBeUndefined();
  });

  it('WeaponsAttachmentVisualizer mounts 3D attachment geometry cleanly', () => {
    const visualizer = new WeaponsAttachmentVisualizer();
    const weaponGroup = new THREE.Group();

    visualizer.mountAttachmentsOnWeapon(weaponGroup, 'ar7', {
      muzzle: 'muzzle_silencer',
      optic: 'optic_reddot',
      grip: 'grip_vertical',
      mag: 'mag_extended',
    });

    const mounted = weaponGroup.children.filter((c) => c.name.startsWith('Gunsmith_Attachment_'));
    expect(mounted.length).toBe(4);
    expect(mounted.some((c) => c.name.includes('muzzle_silencer'))).toBe(true);
    expect(mounted.some((c) => c.name.includes('optic_reddot'))).toBe(true);
    expect(mounted.some((c) => c.name.includes('grip_vertical'))).toBe(true);
    expect(mounted.some((c) => c.name.includes('mag_extended'))).toBe(true);
  });
});
