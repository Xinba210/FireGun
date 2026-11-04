/**
 * FireGun Tactical Haptics & Vibration Engine
 * Provides authentic tactical vibrations for shooting, taking damage, reloading, and hit confirmations.
 * Gracefully degrades on unsupported platforms (iOS Safari without vibration / Desktop).
 */

export class HapticFeedbackManager {
  private enabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('firegun_haptics_enabled');
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch {}
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    try {
      localStorage.setItem('firegun_haptics_enabled', String(val));
    } catch {}
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    if (this.enabled) {
      this.vibrate(20);
    }
    return this.enabled;
  }

  private vibrate(pattern: number | number[]): void {
    if (!this.enabled || !this.isSupported()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore security policy or vibration errors on non-active tabs
    }
  }

  /**
   * Weapon discharge recoil impulse (8ms ~ 28ms)
   */
  public triggerShot(weaponId: string = 'ar7'): void {
    switch (weaponId) {
      case 'rl7':
        this.vibrate(32);
        break;
      case 'sg12':
      case 'sr9':
        this.vibrate(18);
        break;
      case 'smg9':
        this.vibrate(8);
        break;
      case 'ar7':
      default:
        this.vibrate(11);
        break;
    }
  }

  /**
   * Player taking enemy bullet or shrapnel damage
   */
  public triggerDamage(): void {
    this.vibrate([25, 35, 25]);
  }

  /**
   * Weapon reload magazine seated and bolt release click
   */
  public triggerReload(): void {
    this.vibrate(12);
  }

  /**
   * Confirm projectile hit on target
   */
  public triggerHit(isHeadshot = false): void {
    if (isHeadshot) {
      this.vibrate([14, 18, 26]); // High-impact triple-pulse crunch
    } else {
      this.vibrate(12); // Crisp single tick
    }
  }
}

export const hapticEngine = new HapticFeedbackManager();
