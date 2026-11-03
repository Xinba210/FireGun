export interface MatchStats {
  clearTimeSec: number;
  totalKills: number;
  headshots: number;
  damageTaken: number;
  alliesAlive: number; // 0, 1, 2
}

export type OperationRank = 'S' | 'A' | 'B' | 'C' | 'F';

export interface MatchRewardResult {
  rank: OperationRank;
  score: number;
  weaponExpGained: number;
  tacticalCreditsEarned: number;
  prevLevel: number;
  newLevel: number;
  unlockedAttachmentId: string | null;
}

export function calculateOperationRank(stats: MatchStats): OperationRank {
  if (stats.clearTimeSec > 600 || stats.totalKills === 0) return 'F';
  let score = 0;
  // Time score (up to 40 pts)
  if (stats.clearTimeSec <= 150) score += 40;
  else if (stats.clearTimeSec <= 240) score += 30;
  else if (stats.clearTimeSec <= 360) score += 20;
  else score += 10;

  // Headshot ratio score (up to 30 pts)
  const hsRatio = stats.totalKills > 0 ? stats.headshots / stats.totalKills : 0;
  if (hsRatio >= 0.5) score += 30;
  else if (hsRatio >= 0.3) score += 20;
  else if (hsRatio >= 0.15) score += 10;

  // Damage taken score (up to 15 pts)
  if (stats.damageTaken < 50) score += 15;
  else if (stats.damageTaken < 100) score += 10;
  else score += 5;

  // Squad survival score (up to 15 pts)
  score += stats.alliesAlive * 7.5;

  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}

export function computeMatchRewards(
  stats: MatchStats,
  currentWeaponExp: number,
  expPerLevel = 500
): MatchRewardResult {
  const rank = calculateOperationRank(stats);
  const rankMultiplier: Record<OperationRank, number> = {
    S: 2.0,
    A: 1.5,
    B: 1.2,
    C: 1.0,
    F: 0.5,
  };

  const baseExp = 400;
  const killExp = stats.totalKills * 60;
  const hsExp = stats.headshots * 80;
  const weaponExpGained = Math.round((baseExp + killExp + hsExp) * rankMultiplier[rank]);

  const baseCredits = 500;
  const tacticalCreditsEarned = Math.round((baseCredits + stats.totalKills * 75) * rankMultiplier[rank]);

  const prevLevel = Math.min(10, Math.floor(currentWeaponExp / expPerLevel) + 1);
  const totalExpAfter = currentWeaponExp + weaponExpGained;
  const newLevel = Math.min(10, Math.floor(totalExpAfter / expPerLevel) + 1);

  let unlockedAttachmentId: string | null = null;
  if (newLevel > prevLevel) {
    const unlocks: Record<number, string> = {
      2: 'muzzle_suppressor',
      3: 'optic_reddot',
      4: 'grip_vert',
      5: 'mag_ext',
      6: 'optic_acog_4x',
      7: 'muzzle_brake',
      8: 'grip_angled',
      9: 'mag_quick',
      10: 'camo_gold',
    };
    unlockedAttachmentId = unlocks[newLevel] || null;
  }

  return {
    rank,
    score: Math.round(weaponExpGained + tacticalCreditsEarned),
    weaponExpGained,
    tacticalCreditsEarned,
    prevLevel,
    newLevel,
    unlockedAttachmentId,
  };
}
