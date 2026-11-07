import * as THREE from 'three';

export type TacticalBootStyleId =
  | 'MILSPEC_HIGH_LACE'
  | 'TACTICAL_ZIP_ASSAULT'
  | 'HEAVY_BREACHER_ARMOR'
  | 'COYOTE_STEALTH_SUEDE';

export interface TacticalBootConfig {
  id: TacticalBootStyleId;
  name: string;
  nameEn: string;
  desc: string;
  leatherColor: number;
  soleColor: number;
  hardwareColor: number;
  roughness: number;
  metalness: number;
}

export const TACTICAL_BOOT_CONFIGS: Record<TacticalBootStyleId, TacticalBootConfig> = {
  MILSPEC_HIGH_LACE: {
    id: 'MILSPEC_HIGH_LACE',
    name: '全地形高筒作戰皮靴',
    nameEn: 'MIL-SPEC 8" COMBAT BOOTS',
    desc: '標準8吋全地形牛皮作戰靴，交錯戰術尼龍鞋帶與金屬快穿孔環，深齒紋Vibram防滑大底。',
    leatherColor: 0x14161a,
    soleColor: 0x0a0c0e,
    hardwareColor: 0x555c66,
    roughness: 0.82,
    metalness: 0.12,
  },
  TACTICAL_ZIP_ASSAULT: {
    id: 'TACTICAL_ZIP_ASSAULT',
    name: '輕量化快拆突擊靴',
    nameEn: 'TACTICAL SIDE-ZIP ASSAULT',
    desc: '內側配備防水金屬拉鍊與快撕魔鬼氈保護蓋，輕量化EVA減震中底與腳踝碳纖維抗扭護片。',
    leatherColor: 0x242830,
    soleColor: 0x16181d,
    hardwareColor: 0x8a929e,
    roughness: 0.68,
    metalness: 0.22,
  },
  HEAVY_BREACHER_ARMOR: {
    id: 'HEAVY_BREACHER_ARMOR',
    name: '重裝破障防爆甲靴',
    nameEn: 'HEAVY BREACHER PLATED BOOTS',
    desc: '配置鋼頭衝擊防護板（Steel Toe Cap）與雙排棘輪式合金鎖扣，加厚耐油防刺穿底盤。',
    leatherColor: 0x111317,
    soleColor: 0x1c1f24,
    hardwareColor: 0xabb5c4,
    roughness: 0.55,
    metalness: 0.55,
  },
  COYOTE_STEALTH_SUEDE: {
    id: 'COYOTE_STEALTH_SUEDE',
    name: '狼棕麂皮潛行靴',
    nameEn: 'COYOTE STEALTH SUEDE BOOTS',
    desc: '狼棕啞光抗磨麂皮，靜音平底消音橡膠，右靴外側整合特戰折疊匕首快拔硬殼插鞘。',
    leatherColor: 0x6e5238,
    soleColor: 0x4a3622,
    hardwareColor: 0x222222,
    roughness: 0.94,
    metalness: 0.05,
  },
};

/**
 * 為指定腳部骨架生成高精度的外掛靴款 3D 幾何細節（金屬扣、快拆拉鍊、鋼頭防護板、折疊刀插鞘）
 */
export function buildBootAccessories(styleId: TacticalBootStyleId, isLeft: boolean): THREE.Group {
  const config = TACTICAL_BOOT_CONFIGS[styleId];
  const group = new THREE.Group();
  group.name = `boot_accessory_${isLeft ? 'l' : 'r'}`;

  const leatherMat = new THREE.MeshStandardMaterial({
    color: config.leatherColor,
    roughness: config.roughness,
    metalness: config.metalness,
  });

  const soleMat = new THREE.MeshStandardMaterial({
    color: config.soleColor,
    roughness: 0.9,
    metalness: 0.05,
  });

  const hardMat = new THREE.MeshStandardMaterial({
    color: config.hardwareColor,
    roughness: 0.35,
    metalness: 0.85,
  });

  const sideSign = isLeft ? 1 : -1;

  if (styleId === 'MILSPEC_HIGH_LACE') {
    // 1. 交錯戰術鞋帶孔與快穿金屬鉤 (Lace Rings)
    const ringGeo = new THREE.TorusGeometry(0.008, 0.0025, 8, 12);
    for (let i = 0; i < 4; i++) {
      const y = 0.06 + i * 0.026;
      const z = 0.06 - i * 0.008;

      const rL = new THREE.Mesh(ringGeo, hardMat);
      rL.position.set(-0.022, y, z);
      rL.rotation.y = Math.PI / 4;
      group.add(rL);

      const rR = new THREE.Mesh(ringGeo, hardMat);
      rR.position.set(0.022, y, z);
      rR.rotation.y = -Math.PI / 4;
      group.add(rR);
    }
  } else if (styleId === 'TACTICAL_ZIP_ASSAULT') {
    // 2. 側面 YKK 戰術拉鍊條與腳踝防扭碳纖維護片
    const zipGeo = new THREE.BoxGeometry(0.006, 0.12, 0.012);
    const zip = new THREE.Mesh(zipGeo, hardMat);
    // 放於內側腳踝
    zip.position.set(-0.042 * sideSign, 0.09, 0.01);
    group.add(zip);

    // 外側腳踝碳纖維抗扭圓片
    const anklePlateGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 16);
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.4, metalness: 0.3 });
    const anklePlate = new THREE.Mesh(anklePlateGeo, carbonMat);
    anklePlate.rotation.z = Math.PI / 2;
    anklePlate.position.set(0.045 * sideSign, 0.08, 0.0);
    group.add(anklePlate);
  } else if (styleId === 'HEAVY_BREACHER_ARMOR') {
    // 3. 鋼頭衝擊外裝甲 (Steel Toe Guard Plate)
    const toePlateGeo = new THREE.BoxGeometry(0.065, 0.038, 0.045);
    const toePlate = new THREE.Mesh(toePlateGeo, hardMat);
    toePlate.position.set(0, 0.025, 0.095);
    toePlate.rotation.x = -0.15;
    group.add(toePlate);

    // 腳背合金雙扣棘輪帶 (Ratchet Buckles)
    const buckleGeo = new THREE.BoxGeometry(0.055, 0.012, 0.014);
    const buckle1 = new THREE.Mesh(buckleGeo, hardMat);
    buckle1.position.set(0, 0.06, 0.05);
    group.add(buckle1);

    const buckle2 = new THREE.Mesh(buckleGeo, hardMat);
    buckle2.position.set(0, 0.10, 0.03);
    group.add(buckle2);
  } else if (styleId === 'COYOTE_STEALTH_SUEDE') {
    // 4. 右靴外側特戰折疊匕首套 (Tactical Boot Knife Sheath)
    if (!isLeft) {
      const sheathGeo = new THREE.BoxGeometry(0.012, 0.11, 0.028);
      const kydexMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.2 });
      const sheath = new THREE.Mesh(sheathGeo, kydexMat);
      sheath.position.set(-0.045, 0.11, 0.01);
      group.add(sheath);

      // 刀柄 (Knife Grip)
      const hiltGeo = new THREE.BoxGeometry(0.01, 0.035, 0.022);
      const hiltMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.4 });
      const hilt = new THREE.Mesh(hiltGeo, hiltMat);
      hilt.position.set(-0.045, 0.175, 0.01);
      group.add(hilt);
    }
  }

  return group;
}

/**
 * 將指定特戰靴外觀與 3D 配件完整套用至角色模型
 */
export function applyBootsToModel(modelRoot: THREE.Object3D, styleId: TacticalBootStyleId) {
  const config = TACTICAL_BOOT_CONFIGS[styleId] || TACTICAL_BOOT_CONFIGS.MILSPEC_HIGH_LACE;

  // 1. 調整靴子本體材質 (MI_Tactical_Balaclava_Boots 相關 Mesh)
  modelRoot.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat) => {
      const stdMat = mat as THREE.MeshStandardMaterial;
      const matName = stdMat.name || '';
      if (matName.includes('Boots') || matName.includes('Balaclava')) {
        stdMat.color.setHex(config.leatherColor);
        stdMat.roughness = config.roughness;
        stdMat.metalness = config.metalness;
        stdMat.needsUpdate = true;
      }
    });
  });

  // 2. 清除舊有靴子配件
  const toRemove: THREE.Object3D[] = [];
  modelRoot.traverse((obj) => {
    if (obj.name && obj.name.startsWith('boot_accessory_')) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach((obj) => {
    if (obj.parent) obj.parent.remove(obj);
  });

  // 3. 掛載至雙腳踝骨架節點
  const footL = modelRoot.getObjectByName('foot_l') || modelRoot.getObjectByName('LeftFoot');
  const footR = modelRoot.getObjectByName('foot_r') || modelRoot.getObjectByName('RightFoot');

  if (footL) {
    const accL = buildBootAccessories(styleId, true);
    footL.add(accL);
  }
  if (footR) {
    const accR = buildBootAccessories(styleId, false);
    footR.add(accR);
  }
}
