import { describe, it, expect } from 'vitest';
import { calculateOperationRank, computeMatchRewards, type MatchStats } from '../src/game/rewards.ts';

describe('Match Rewards & After-Action Report (AAR) System', () => {
  it('awards rank S for fast clear, high headshot ratio, and full squad survival', () => {
    const stats: MatchStats = {
      clearTimeSec: 120,
      totalKills: 8,
      headshots: 5,
      damageTaken: 25,
      alliesAlive: 2,
    };
    const rank = calculateOperationRank(stats);
    expect(rank).toBe('S');
  });

  it('awards rank C or F for slow or failed operations', () => {
    const failStats: MatchStats = {
      clearTimeSec: 650,
      totalKills: 0,
      headshots: 0,
      damageTaken: 200,
      alliesAlive: 0,
    };
    expect(calculateOperationRank(failStats)).toBe('F');
  });

  it('calculates EXP progress and triggers level up with attachment unlock', () => {
    const stats: MatchStats = {
      clearTimeSec: 140,
      totalKills: 8,
      headshots: 4,
      damageTaken: 40,
      alliesAlive: 2,
    };
    // Starting at 450 EXP (Level 1, just before Level 2 threshold at 500)
    const res = computeMatchRewards(stats, 450, 500);
    expect(res.weaponExpGained).toBeGreaterThan(1000);
    expect(res.prevLevel).toBe(1);
    expect(res.newLevel).toBeGreaterThanOrEqual(2);
    expect(res.unlockedAttachmentId).toBeDefined();
  });
});
