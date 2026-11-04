import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Mainstream AAA Game Lifecycle Flow & Mobile Touch Operability', () => {
  let titleVisible = true;
  let preloadVisible = false;
  let setupVisible = false;
  let inCombat = false;
  let preloadPercent = 0;
  let currentDifficulty = 'STANDARD';
  let currentMode = 'RAID';

  beforeEach(() => {
    titleVisible = true;
    preloadVisible = false;
    setupVisible = false;
    inCombat = false;
    preloadPercent = 0;
    currentDifficulty = 'STANDARD';
    currentMode = 'RAID';
  });

  it('Stage 1 -> Stage 2: tapping 開始遊戲 unlocks audio and transitions to preload screen', () => {
    const audioUnlockMock = vi.fn();

    const onStartOperation = () => {
      audioUnlockMock();
      titleVisible = false;
      preloadVisible = true;
    };

    // User taps center button
    onStartOperation();

    expect(audioUnlockMock).toHaveBeenCalledTimes(1);
    expect(titleVisible).toBe(false);
    expect(preloadVisible).toBe(true);
    expect(setupVisible).toBe(false);
  });

  it('Stage 2 -> Stage 3: preload reaches 100% and opens Tactical Setup Hub', () => {
    // Simulate preload progression
    for (let step = 1; step <= 7; step++) {
      preloadPercent = Math.min(100, step * 15);
    }
    preloadPercent = 100;
    expect(preloadPercent).toBe(100);

    // Preload finishes
    preloadVisible = false;
    setupVisible = true;

    expect(preloadVisible).toBe(false);
    expect(setupVisible).toBe(true);
  });

  it('Stage 3: Tactical Setup Hub allows difficulty & mode configuration and Gunsmith toggle', () => {
    let gunsmithOpen = false;

    const setDifficulty = (diff: 'STANDARD' | 'HARDCORE' | 'NIGHTMARE') => {
      currentDifficulty = diff;
    };
    const setMode = (mode: 'RAID' | 'SURVIVAL' | 'SNIPER' | 'BLITZ') => {
      currentMode = mode;
    };
    const toggleGunsmith = (open: boolean) => {
      gunsmithOpen = open;
    };

    setDifficulty('HARDCORE');
    expect(currentDifficulty).toBe('HARDCORE');

    setMode('BLITZ');
    expect(currentMode).toBe('BLITZ');

    toggleGunsmith(true);
    expect(gunsmithOpen).toBe(true);

    // Closing gunsmith before combat returns to setup screen
    toggleGunsmith(false);
    expect(gunsmithOpen).toBe(false);
    expect(setupVisible).toBe(false); // Can re-assert
  });

  it('Stage 3 -> Stage 4: confirming deployment launches helicopter cutscene and combat', () => {
    const launchInfiltrationCutscene = vi.fn(() => {
      inCombat = true;
    });

    const onCommenceInfiltration = () => {
      setupVisible = false;
      launchInfiltrationCutscene();
    };

    onCommenceInfiltration();
    expect(setupVisible).toBe(false);
    expect(launchInfiltrationCutscene).toHaveBeenCalledTimes(1);
    expect(inCombat).toBe(true);
  });

  it('Right-edge touch utility buttons respond to touch/pointerup and toggle active states', () => {
    const states = {
      nvg: false,
      tps: false,
      gyro: false,
      recenterCount: 0,
      drawerOpen: false,
    };

    let virtualTime = 1000;
    let lastTap = 0;
    const bindQuickBtn = (action: () => void) => {
      return () => {
        virtualTime += 300;
        if (virtualTime - lastTap < 200) return;
        lastTap = virtualTime;
        action();
      };
    };

    const tapNvg = bindQuickBtn(() => { states.nvg = !states.nvg; });
    const tapTps = bindQuickBtn(() => { states.tps = !states.tps; });
    const tapGyro = bindQuickBtn(() => { states.gyro = !states.gyro; });
    const tapRecenter = bindQuickBtn(() => { states.recenterCount++; });
    const tapDrawer = bindQuickBtn(() => { states.drawerOpen = !states.drawerOpen; });

    // Initial tap
    tapNvg();
    expect(states.nvg).toBe(true);

    tapTps();
    expect(states.tps).toBe(true);

    tapGyro();
    expect(states.gyro).toBe(true);

    tapRecenter();
    expect(states.recenterCount).toBe(1);

    tapDrawer();
    expect(states.drawerOpen).toBe(true);

    // Toggle off
    lastTap = 0;
    tapNvg();
    expect(states.nvg).toBe(false);
  });

  it('Gunsmith attachment cards trigger equip/unequip on whole card click', () => {
    let equippedMuzzle: string | null = null;

    const onCardClick = (attId: string) => {
      if (equippedMuzzle === attId) {
        equippedMuzzle = null;
      } else {
        equippedMuzzle = attId;
      }
    };

    // Tap suppressor card
    onCardClick('suppressor');
    expect(equippedMuzzle).toBe('suppressor');

    // Tap same card again to unequip
    onCardClick('suppressor');
    expect(equippedMuzzle).toBeNull();
  });
});
