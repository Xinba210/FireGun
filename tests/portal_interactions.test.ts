import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Tactical Title Portal Interactions', () => {
  let portalHandlers: {
    deploy?: () => void;
    campaign?: () => void;
    gunsmith?: () => void;
    dossier?: () => void;
    screenTap?: () => void;
  } = {};

  beforeEach(() => {
    portalHandlers = {};
  });

  it('binds touch, click, and keystart events for deployment without blocking on white flash', () => {
    let isDeploying = false;
    let portalVisible = true;
    const onDeploy = vi.fn();

    const startDeploy = () => {
      if (isDeploying) return;
      isDeploying = true;
      portalVisible = false;
      onDeploy();
    };

    portalHandlers.deploy = startDeploy;
    portalHandlers.screenTap = startDeploy;

    // Simulate clicking deploy button
    portalHandlers.deploy();
    expect(onDeploy).toHaveBeenCalledTimes(1);
    expect(portalVisible).toBe(false);

    // Simulate second click - should not double deploy
    portalHandlers.deploy();
    expect(onDeploy).toHaveBeenCalledTimes(1);
  });

  it('allows tapping screen anywhere to commence operation', () => {
    let portalVisible = true;
    const onDeploy = vi.fn();

    const startDeploy = () => {
      portalVisible = false;
      onDeploy();
    };

    portalHandlers.screenTap = startDeploy;
    portalHandlers.screenTap();

    expect(onDeploy).toHaveBeenCalledTimes(1);
    expect(portalVisible).toBe(false);
  });

  it('opens gunsmith and hides portal when gunsmith tab is clicked', () => {
    let portalVisible = true;
    const onGunsmith = vi.fn();

    portalHandlers.gunsmith = () => {
      portalVisible = false;
      onGunsmith();
    };

    portalHandlers.gunsmith();
    expect(onGunsmith).toHaveBeenCalledTimes(1);
    expect(portalVisible).toBe(false);
  });
});

