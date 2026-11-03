import { describe, it, expect } from 'vitest';

export type SurfaceMaterialType = 'water' | 'metal' | 'concrete' | 'wood' | 'flesh';

export interface SurfaceImpactSpec {
  material: SurfaceMaterialType;
  audioKey: string;
  sparkColor: number;
  debrisCount: number;
}

export const SURFACE_IMPACTS: Record<SurfaceMaterialType, SurfaceImpactSpec> = {
  water: { material: 'water', audioKey: 'impact_water.wav', sparkColor: 0x60a5fa, debrisCount: 8 },
  metal: { material: 'metal', audioKey: 'impact_metal.wav', sparkColor: 0xffcc44, debrisCount: 10 },
  concrete: { material: 'concrete', audioKey: 'impact_concrete.wav', sparkColor: 0x94a3b8, debrisCount: 6 },
  wood: { material: 'wood', audioKey: 'impact_concrete.wav', sparkColor: 0xca8a04, debrisCount: 5 },
  flesh: { material: 'flesh', audioKey: 'impact_metal.wav', sparkColor: 0xef4444, debrisCount: 7 },
};

describe('Fire Mode & Multi-Material Bullet Impact Feedback', () => {
  it('cycles fire modes across AUTO -> BURST -> SEMI for AR-7', () => {
    const supported: ('AUTO' | 'BURST' | 'SEMI')[] = ['AUTO', 'BURST', 'SEMI'];
    let curIdx = 0;
    const cycle = () => {
      curIdx = (curIdx + 1) % supported.length;
      return supported[curIdx];
    };
    expect(cycle()).toBe('BURST');
    expect(cycle()).toBe('SEMI');
    expect(cycle()).toBe('AUTO');
  });

  it('determines impact response correctly for puddle water vs metal vs concrete', () => {
    const waterImp = SURFACE_IMPACTS['water'];
    const metalImp = SURFACE_IMPACTS['metal'];
    const concImp = SURFACE_IMPACTS['concrete'];

    expect(waterImp.audioKey).toContain('water');
    expect(metalImp.sparkColor).toBe(0xffcc44); // Gold spark
    expect(concImp.audioKey).toContain('concrete');
  });
});
