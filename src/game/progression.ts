export interface WeaponAttachment {
  id: string;
  name: string;
  slot: 'muzzle' | 'optic' | 'grip' | 'mag';
  desc: string;
  unlockLevel: number;
  cost: number;
  statMods: {
    damageAdd?: number;
    recoilMult?: number;
    reloadTimeMult?: number;
    adsFov?: number;
    adsSpeedMult?: number;
    magSizeAdd?: number;
    soundQuiet?: boolean;
    hasPipScope?: boolean;
  };
}

export interface WeaponProgressionState {
  level: number;
  exp: number;
  equippedAttachments: {
    muzzle?: string;
    optic?: string;
    grip?: string;
    mag?: string;
  };
}

export interface PlayerProgressionData {
  credits: number;
  armorType: 'LIGHT' | 'STANDARD' | 'HEAVY';
  tacticalGadget: 'GRENADE' | 'FLASH' | 'SMOKE' | 'MINE';
  activePerks: string[];
  weapons: Record<string, WeaponProgressionState>;
  stats: {
    totalKills: number;
    totalHeadshots: number;
    totalPlayTimeSec: number;
    bestRaidTimeSec: number;
    highestSurvivalWave: number;
    bestBlitzScore: number;
  };
}

export const ATTACHMENTS_CATALOG: WeaponAttachment[] = [
  // Muzzle
  {
    id: 'muzzle_silencer',
    name: '戰術消音器 (Suppressor)',
    slot: 'muzzle',
    desc: '大幅降低開火聲響與槍口火光，有效隱蔽射擊位置，射程與初速微幅下降。',
    unlockLevel: 2,
    cost: 250,
    statMods: { recoilMult: 0.92, soundQuiet: true, damageAdd: -2 },
  },
  {
    id: 'muzzle_brake',
    name: '多孔制退器 (Compensator)',
    slot: 'muzzle',
    desc: '氣體向上導流，顯著壓制連續開火的垂直上揚後座力，但槍口火光放大。',
    unlockLevel: 4,
    cost: 400,
    statMods: { recoilMult: 0.72 },
  },
  // Optic
  {
    id: 'optic_reddot',
    name: '微型紅點 (Mini Red Dot)',
    slot: 'optic',
    desc: '開闊的近距反射瞄具，準星中心投影 2 MOA 紅色光點，提升近距快速捕靶速度。',
    unlockLevel: 1,
    cost: 150,
    statMods: { adsFov: 48, adsSpeedMult: 1.25 },
  },
  {
    id: 'optic_holo',
    name: '全息瞄具 (EOTech Holo)',
    slot: 'optic',
    desc: '經典 68 MOA 圓環戰術標線，提供絕佳的目標鎖定視野與晃動耐受度。',
    unlockLevel: 3,
    cost: 320,
    statMods: { adsFov: 44, adsSpeedMult: 1.15 },
  },
  {
    id: 'optic_acog2x',
    name: 'ACOG 2x 稜鏡瞄具',
    slot: 'optic',
    desc: '中距離戰術放大鏡，具備彈道分劃刻度，適應港口碼頭與貨櫃長廊。',
    unlockLevel: 5,
    cost: 600,
    statMods: { adsFov: 32, adsSpeedMult: 0.95 },
  },
  {
    id: 'optic_sniper4x',
    name: 'NightForce 4x 測距鏡 (PiP)',
    slot: 'optic',
    desc: '高倍率光學瞄準鏡，支援雙相機鏡內畫中畫（Picture-in-Picture）真實放大視野。',
    unlockLevel: 7,
    cost: 950,
    statMods: { adsFov: 18, adsSpeedMult: 0.85, hasPipScope: true },
  },
  // Grip
  {
    id: 'grip_vertical',
    name: '垂直前握把 (Vertical Grip)',
    slot: 'grip',
    desc: '堅固的下掛垂直握把，提供雙手良好支點，大幅穩定全自動壓槍連射。',
    unlockLevel: 2,
    cost: 200,
    statMods: { recoilMult: 0.82 },
  },
  {
    id: 'grip_angled',
    name: '戰術斜角握把 (Angled Grip)',
    slot: 'grip',
    desc: '符合人體工學的 45 度斜置握把，顯著加快舉槍瞄準（ADS）轉換速度。',
    unlockLevel: 4,
    cost: 350,
    statMods: { adsSpeedMult: 1.35, recoilMult: 0.94 },
  },
  // Mag
  {
    id: 'mag_extended',
    name: '擴充加大彈匣 (+12 Rounds)',
    slot: 'mag',
    desc: '加長型高容量供彈匣，大幅提升戰術續航力，因重量增加使換彈速度稍慢。',
    unlockLevel: 3,
    cost: 300,
    statMods: { magSizeAdd: 12, reloadTimeMult: 1.18 },
  },
  {
    id: 'mag_quickdraw',
    name: '雙聯快拔彈匣 (Quick-Pull)',
    slot: 'mag',
    desc: '輕量化並加裝彈匣快拔膠環，換彈速度大幅加快 35%，極利於近戰突入。',
    unlockLevel: 6,
    cost: 500,
    statMods: { reloadTimeMult: 0.68 },
  },
];

export const EXP_PER_LEVEL = [0, 300, 750, 1400, 2300, 3500, 5000, 7000, 9500, 12500];

const STORAGE_KEY = 'firegun_progression_v1';

export function getDefaultProgression(): PlayerProgressionData {
  return {
    credits: 650,
    armorType: 'STANDARD',
    tacticalGadget: 'GRENADE',
    activePerks: ['STEADY_AIM', 'FAST_RELOAD'],
    weapons: {
      ar7: { level: 3, exp: 850, equippedAttachments: { optic: 'optic_reddot', grip: 'grip_vertical' } },
      smg9: { level: 2, exp: 400, equippedAttachments: { optic: 'optic_reddot' } },
      sg12: { level: 1, exp: 120, equippedAttachments: {} },
      sr9: { level: 4, exp: 1600, equippedAttachments: { optic: 'optic_sniper4x' } },
      rl7: { level: 1, exp: 0, equippedAttachments: {} },
    },
    stats: {
      totalKills: 14,
      totalHeadshots: 6,
      totalPlayTimeSec: 420,
      bestRaidTimeSec: 168,
      highestSurvivalWave: 4,
      bestBlitzScore: 1250,
    },
  };
}

let inMemoryData: PlayerProgressionData | null = null;

export function loadProgression(): PlayerProgressionData {
  if (inMemoryData) return inMemoryData;
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        inMemoryData = { ...getDefaultProgression(), ...parsed };
        return inMemoryData!;
      }
    }
  } catch {
    // fallback
  }
  inMemoryData = getDefaultProgression();
  return inMemoryData!;
}

export function saveProgression(data?: PlayerProgressionData): void {
  if (data) inMemoryData = data;
  if (!inMemoryData) inMemoryData = getDefaultProgression();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
    }
  } catch {
    // ignore
  }
}

export function addWeaponExp(weaponId: string, amount: number): { leveledUp: boolean; newLevel: number } {
  const p = loadProgression();
  if (!p.weapons[weaponId]) {
    p.weapons[weaponId] = { level: 1, exp: 0, equippedAttachments: {} };
  }
  const w = p.weapons[weaponId];
  const oldLevel = w.level;
  w.exp += amount;

  // Check level cap 10
  let lvl = 1;
  for (let i = 1; i <= 10; i++) {
    if (w.exp >= (EXP_PER_LEVEL[i - 1] || 0)) {
      lvl = i;
    } else {
      break;
    }
  }
  w.level = Math.min(10, lvl);
  saveProgression(p);
  return { leveledUp: w.level > oldLevel, newLevel: w.level };
}

export function equipAttachment(weaponId: string, attachmentId: string): boolean {
  const p = loadProgression();
  const att = ATTACHMENTS_CATALOG.find((a) => a.id === attachmentId);
  if (!att) return false;
  if (!p.weapons[weaponId]) {
    p.weapons[weaponId] = { level: 1, exp: 0, equippedAttachments: {} };
  }
  const w = p.weapons[weaponId];
  if (w.level < att.unlockLevel && p.credits < att.cost) {
    return false;
  }
  // If not unlocked by level but user has credits, purchase it
  if (w.level < att.unlockLevel && p.credits >= att.cost) {
    p.credits -= att.cost;
  }
  w.equippedAttachments[att.slot] = attachmentId;
  saveProgression(p);
  return true;
}

export function unequipAttachment(weaponId: string, slot: 'muzzle' | 'optic' | 'grip' | 'mag'): void {
  const p = loadProgression();
  if (p.weapons[weaponId]?.equippedAttachments) {
    delete p.weapons[weaponId].equippedAttachments[slot];
    saveProgression(p);
  }
}

export function calculateWeaponEffectiveStats(
  baseWeapon: {
    damage: number;
    recoilPitch: number;
    recoilZ: number;
    reloadTime: number;
    adsFov: number;
    magSize: number;
  },
  weaponId: string
) {
  const p = loadProgression();
  const eq = p.weapons[weaponId]?.equippedAttachments || {};
  let dmg = baseWeapon.damage;
  let recoilP = baseWeapon.recoilPitch;
  let recoilZ = baseWeapon.recoilZ;
  let reloadT = baseWeapon.reloadTime;
  let fov = baseWeapon.adsFov;
  let mag = baseWeapon.magSize;
  let quiet = false;
  let hasPip = false;

  for (const slotKey of ['muzzle', 'optic', 'grip', 'mag'] as const) {
    const attId = eq[slotKey];
    if (!attId) continue;
    const att = ATTACHMENTS_CATALOG.find((a) => a.id === attId);
    if (!att) continue;
    const m = att.statMods;
    if (m.damageAdd) dmg += m.damageAdd;
    if (m.recoilMult) {
      recoilP *= m.recoilMult;
      recoilZ *= m.recoilMult;
    }
    if (m.reloadTimeMult) reloadT *= m.reloadTimeMult;
    if (m.adsFov !== undefined) fov = m.adsFov;
    if (m.magSizeAdd) mag += m.magSizeAdd;
    if (m.soundQuiet) quiet = true;
    if (m.hasPipScope) hasPip = true;
  }

  return {
    damage: Math.round(dmg),
    recoilPitch: Number(recoilP.toFixed(4)),
    recoilZ: Number(recoilZ.toFixed(4)),
    reloadTime: Number(reloadT.toFixed(2)),
    adsFov: fov,
    magSize: mag,
    isSilenced: quiet,
    hasPipScope: hasPip,
  };
}
