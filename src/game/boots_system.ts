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
    desc: '標準8吋全地形牛皮作戰靴，交錯戰術尼龍鞋帶與金屬快穿孔環，加厚深齒防滑大底。',
    leatherColor: 0x111317,
    soleColor: 0x070809,
    hardwareColor: 0x8a929e,
    roughness: 0.85,
    metalness: 0.12,
  },
  TACTICAL_ZIP_ASSAULT: {
    id: 'TACTICAL_ZIP_ASSAULT',
    name: '輕量化快拆突擊靴',
    nameEn: 'TACTICAL SIDE-ZIP ASSAULT',
    desc: '內側配備防水金屬拉鍊與快撕魔鬼氈保護蓋，輕量化EVA減震中底與腳踝碳纖維抗扭護片。',
    leatherColor: 0x242830,
    soleColor: 0x14161a,
    hardwareColor: 0xd0d8e2,
    roughness: 0.68,
    metalness: 0.22,
  },
  HEAVY_BREACHER_ARMOR: {
    id: 'HEAVY_BREACHER_ARMOR',
    name: '重裝破障防爆甲靴',
    nameEn: 'HEAVY BREACHER PLATED BOOTS',
    desc: '靴面配置超大鋼頭防衝擊合金裝甲板（Steel Toe Cap）與雙排合金棘輪鎖扣，厚重防爆。',
    leatherColor: 0x0d0e12,
    soleColor: 0x1a1c22,
    hardwareColor: 0xe2e8f0,
    roughness: 0.45,
    metalness: 0.82,
  },
  COYOTE_STEALTH_SUEDE: {
    id: 'COYOTE_STEALTH_SUEDE',
    name: '狼棕麂皮潛行靴',
    nameEn: 'COYOTE STEALTH SUEDE BOOTS',
    desc: '狼棕高對比啞光抗磨麂皮，右靴外側整合特戰折疊匕首快拔硬殼插鞘與軍規握柄。',
    leatherColor: 0x8a623e,
    soleColor: 0x543c26,
    hardwareColor: 0x1a1a1a,
    roughness: 0.95,
    metalness: 0.05,
  },
};

/**
 * 建立左右腳不同靴款的顯著幾何特徵 (在世界座標系下直接錨定於雙腳，外觀辨識度極高)
 */
function createBootOverlays(styleId: TacticalBootStyleId, posX: number, isLeft: boolean): THREE.Group {
  const config = TACTICAL_BOOT_CONFIGS[styleId];
  const bootGroup = new THREE.Group();
  bootGroup.name = `boot_visual_${isLeft ? 'l' : 'r'}`;
  bootGroup.position.set(posX, 0, 0);

  const leatherMat = new THREE.MeshStandardMaterial({
    color: config.leatherColor,
    roughness: config.roughness,
    metalness: config.metalness,
  });

  const soleMat = new THREE.MeshStandardMaterial({
    color: config.soleColor,
    roughness: 0.92,
    metalness: 0.08,
  });

  const hardMat = new THREE.MeshStandardMaterial({
    color: config.hardwareColor,
    roughness: 0.28,
    metalness: config.metalness > 0.5 ? 0.9 : 0.6,
  });

  const sideSign = isLeft ? 1 : -1;

  // 1. 底層厚實戰術鞋底（加厚橡膠齒紋大底，清晰可見）
  const soleGeo = new THREE.BoxGeometry(0.11, 0.035, 0.25);
  const soleMesh = new THREE.Mesh(soleGeo, soleMat);
  soleMesh.position.set(0, 0.018, 0.02);
  bootGroup.add(soleMesh);

  if (styleId === 'MILSPEC_HIGH_LACE') {
    // 【款式 1：全地形高筒綁帶靴】
    // 8 吋高筒皮革鞋筒包覆
    const cuffGeo = new THREE.CylinderGeometry(0.065, 0.062, 0.16, 16);
    const cuffMesh = new THREE.Mesh(cuffGeo, leatherMat);
    cuffMesh.position.set(0, 0.16, -0.01);
    bootGroup.add(cuffMesh);

    // 4 對金屬鞋帶環扣與白色編織交錯鞋帶
    const laceGeo = new THREE.BoxGeometry(0.045, 0.006, 0.008);
    const laceMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const y = 0.06 + i * 0.032;
      const z = 0.07 - i * 0.015;
      const lace = new THREE.Mesh(laceGeo, laceMat);
      lace.position.set(0, y, z);
      lace.rotation.x = -0.3;
      bootGroup.add(lace);

      // 左右金屬鞋眼
      const eyeletGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.006, 8);
      const eyeL = new THREE.Mesh(eyeletGeo, hardMat);
      eyeL.rotation.z = Math.PI / 2;
      eyeL.position.set(-0.025, y, z);
      bootGroup.add(eyeL);

      const eyeR = new THREE.Mesh(eyeletGeo, hardMat);
      eyeR.rotation.z = Math.PI / 2;
      eyeR.position.set(0.025, y, z);
      bootGroup.add(eyeR);
    }
  } else if (styleId === 'TACTICAL_ZIP_ASSAULT') {
    // 【款式 2：輕量化側拉鍊突擊靴】
    const cuffGeo = new THREE.CylinderGeometry(0.062, 0.058, 0.14, 16);
    const cuffMesh = new THREE.Mesh(cuffGeo, leatherMat);
    cuffMesh.position.set(0, 0.15, -0.01);
    bootGroup.add(cuffMesh);

    // 內側 YKK 金屬拉鍊與拉頭
    const zipGeo = new THREE.BoxGeometry(0.008, 0.15, 0.014);
    const zip = new THREE.Mesh(zipGeo, hardMat);
    zip.position.set(-0.058 * sideSign, 0.15, 0.01);
    bootGroup.add(zip);

    // 外側腳踝大直徑碳纖維抗扭圓形護片 (高反差)
    const carbonGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.01, 16);
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.6 });
    const carbonPlate = new THREE.Mesh(carbonGeo, carbonMat);
    carbonPlate.rotation.z = Math.PI / 2;
    carbonPlate.position.set(0.062 * sideSign, 0.12, -0.01);
    bootGroup.add(carbonPlate);

    // 踝部魔鬼氈固定護帶
    const strapGeo = new THREE.BoxGeometry(0.125, 0.02, 0.13);
    const strap = new THREE.Mesh(strapGeo, leatherMat);
    strap.position.set(0, 0.21, -0.01);
    bootGroup.add(strap);
  } else if (styleId === 'HEAVY_BREACHER_ARMOR') {
    // 【款式 3：重裝鋼頭防爆甲靴】
    // 前掌超顯眼金屬鋼頭衝擊外裝甲 (Steel Toe Cap Armor)
    const toeGeo = new THREE.BoxGeometry(0.115, 0.065, 0.09);
    const toeArmor = new THREE.Mesh(toeGeo, hardMat);
    toeArmor.position.set(0, 0.045, 0.10);
    toeArmor.rotation.x = -0.12;
    bootGroup.add(toeArmor);

    // 腳背超合金雙重卡扣鎖板 (Dual Heavy Ratchet Buckles)
    const plateGeo = new THREE.BoxGeometry(0.095, 0.022, 0.035);
    const buckle1 = new THREE.Mesh(plateGeo, hardMat);
    buckle1.position.set(0, 0.09, 0.04);
    buckle1.rotation.x = -0.35;
    bootGroup.add(buckle1);

    const buckle2 = new THREE.Mesh(plateGeo, hardMat);
    buckle2.position.set(0, 0.14, 0.015);
    buckle2.rotation.x = -0.2;
    bootGroup.add(buckle2);

    // 脛骨前方防彈裝甲外襯 (Shin Guard)
    const shinGeo = new THREE.BoxGeometry(0.075, 0.12, 0.02);
    const shinMesh = new THREE.Mesh(shinGeo, hardMat);
    shinMesh.position.set(0, 0.21, 0.048);
    shinMesh.rotation.x = -0.08;
    bootGroup.add(shinMesh);
  } else if (styleId === 'COYOTE_STEALTH_SUEDE') {
    // 【款式 4：狼棕麂皮消音潛行靴】
    const cuffGeo = new THREE.CylinderGeometry(0.064, 0.06, 0.15, 16);
    const cuffMesh = new THREE.Mesh(cuffGeo, leatherMat);
    cuffMesh.position.set(0, 0.155, -0.01);
    bootGroup.add(cuffMesh);

    // 右靴外側特戰折疊匕首快拔套 (Kydex Sheath & Knife)
    if (!isLeft) {
      const sheathGeo = new THREE.BoxGeometry(0.02, 0.14, 0.038);
      const kydexMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.2 });
      const sheath = new THREE.Mesh(sheathGeo, kydexMat);
      sheath.position.set(0.072, 0.17, 0.01);
      bootGroup.add(sheath);

      // 戰術匕首軍規防滑握柄與刀刃出鞘防護套
      const hiltGeo = new THREE.BoxGeometry(0.016, 0.055, 0.028);
      const hiltMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.5 });
      const hilt = new THREE.Mesh(hiltGeo, hiltMat);
      hilt.position.set(0.072, 0.26, 0.01);
      bootGroup.add(hilt);
    }
  }

  return bootGroup;
}

/**
 * 將指定特戰靴外觀、材質與顯著 3D 配件完整套用至角色模型
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

  // 2. 清除舊有外觀靴層
  const toRemove: THREE.Object3D[] = [];
  modelRoot.traverse((obj) => {
    if (obj.name && (obj.name.startsWith('boot_accessory_') || obj.name.startsWith('boot_visual_'))) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach((obj) => {
    if (obj.parent) obj.parent.remove(obj);
  });

  // 3. 在雙腳精確位置創建左右兩隻立體靴套件 (左腳 x=0.134, 右腳 x=-0.134)
  const leftBoot = createBootOverlays(styleId, 0.134, true);
  const rightBoot = createBootOverlays(styleId, -0.134, false);

  modelRoot.add(leftBoot);
  modelRoot.add(rightBoot);
}
