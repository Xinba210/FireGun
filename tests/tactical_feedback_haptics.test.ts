import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HapticFeedbackManager } from '../src/game/haptics.ts';

describe('Tactical Haptics & Vibration Engine', () => {
  let haptics: HapticFeedbackManager;

  beforeEach(() => {
    // Mock navigator.vibrate
    vi.stubGlobal('navigator', {
      vibrate: vi.fn(),
    });
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
    haptics = new HapticFeedbackManager();
  });

  it('should initialize enabled by default', () => {
    expect(haptics.isEnabled()).toBe(true);
    expect(haptics.isSupported()).toBe(true);
  });

  it('should toggle enabled state and save to localStorage', () => {
    const newState = haptics.toggle();
    expect(newState).toBe(false);
    expect(haptics.isEnabled()).toBe(false);
    expect(localStorage.getItem('firegun_haptics_enabled')).toBe('false');

    const backOn = haptics.toggle();
    expect(backOn).toBe(true);
    expect(haptics.isEnabled()).toBe(true);
  });

  it('should trigger distinct vibration patterns for weapons, damage, and reload', () => {
    const spy = vi.spyOn(navigator, 'vibrate');

    haptics.triggerShot('ar7');
    expect(spy).toHaveBeenCalledWith(11);

    haptics.triggerShot('rl7');
    expect(spy).toHaveBeenCalledWith(32);

    haptics.triggerShot('sg12');
    expect(spy).toHaveBeenCalledWith(18);

    haptics.triggerDamage();
    expect(spy).toHaveBeenCalledWith([25, 35, 25]);

    haptics.triggerReload();
    expect(spy).toHaveBeenCalledWith(12);
  });

  it('should trigger headshot crunch vibration pattern on headshot', () => {
    const spy = vi.spyOn(navigator, 'vibrate');

    haptics.triggerHit(false);
    expect(spy).toHaveBeenCalledWith(12);

    haptics.triggerHit(true);
    expect(spy).toHaveBeenCalledWith([14, 18, 26]);
  });

  it('should cleanly suppress vibrations when disabled', () => {
    haptics.setEnabled(false);
    const spy = vi.spyOn(navigator, 'vibrate');

    haptics.triggerShot('ar7');
    haptics.triggerDamage();
    haptics.triggerHit(true);

    expect(spy).not.toHaveBeenCalled();
  });
});
