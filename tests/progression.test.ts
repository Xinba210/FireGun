import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultProgression,
  loadProgression,
  saveProgression,
  addWeaponExp,
  equipAttachment,
  unequipAttachment,
  calculateWeaponEffectiveStats,
} from '../src/game/progression.ts';

describe('Progression & Weapon Attachment System', () => {
  beforeEach(() => {
    saveProgression(getDefaultProgression());
  });

  it('loads default progression data cleanly', () => {
    const p = loadProgression();
    expect(p.credits).toBeGreaterThanOrEqual(100);
    expect(p.weapons.ar7.level).toBeGreaterThanOrEqual(1);
    expect(p.weapons.ar7.equippedAttachments.optic).toBe('optic_reddot');
  });

  it('levels up weapon when enough exp is gained', () => {
    const res = addWeaponExp('ar7', 1500);
    expect(res.newLevel).toBeGreaterThanOrEqual(3);
    const p = loadProgression();
    expect(p.weapons.ar7.exp).toBeGreaterThanOrEqual(1500);
  });

  it('calculates weapon effective stats with attachments accurately', () => {
    const base = {
      damage: 34,
      recoilPitch: 0.016,
      recoilZ: 0.038,
      reloadTime: 1.55,
      adsFov: 44,
      magSize: 36,
    };
    equipAttachment('ar7', 'mag_extended');
    const stats = calculateWeaponEffectiveStats(base, 'ar7');
    expect(stats.magSize).toBe(48); // 36 + 12
    expect(stats.reloadTime).toBeGreaterThan(1.55); // slower reload due to extended mag
  });

  it('handles unequip of attachment slot', () => {
    unequipAttachment('ar7', 'optic');
    const p = loadProgression();
    expect(p.weapons.ar7.equippedAttachments.optic).toBeUndefined();
  });
});
