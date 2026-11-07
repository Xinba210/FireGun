import * as THREE from 'three';
import { SecondaryMotionManager } from './secondary_motion.ts';

export type TacticalLoadoutType = 'ASSAULT' | 'RECON' | 'BREACHER' | 'SNIPER';

export interface TacticalGearNodes {
  accessoriesGroup: THREE.Group;
  helmetGroup: THREE.Group;
  nvgGroup: THREE.Group;
  vestGroup: THREE.Group;
  radioAntenna: THREE.Mesh;
  slingMesh: THREE.Mesh;
  hydrationTube: THREE.Mesh;
  legHolsterGroup: THREE.Group;
  utilityPouchGroup: THREE.Group;
  hangingGloves: THREE.Group;
  loadoutType: TacticalLoadoutType;
  secondaryMotionMgr: SecondaryMotionManager;
}

/**
 * 為角色骨架建立多套細緻化戰術配件群組（支援 ASSAULT, RECON, BREACHER, SNIPER）
 * 並註冊精準物理次級動態 (Secondary Motion)
 */
export function attachTacticalGear(
  characterRoot: THREE.Object3D,
  parentMotionTarget: THREE.Object3D,
  loadoutType: TacticalLoadoutType = 'ASSAULT'
): TacticalGearNodes {
  // 先清理可能殘留的舊配件群組
  const existing = characterRoot.getObjectByName('tactical_accessories_root');
  if (existing && existing.parent) {
    existing.parent.remove(existing);
  }

  const accessoriesGroup = new THREE.Group();
  accessoriesGroup.name = 'tactical_accessories_root';
  characterRoot.add(accessoriesGroup);

  const secondaryMgr = new SecondaryMotionManager(parentMotionTarget);

  // 1. 尋找關鍵骨骼節點
  let headBone = characterRoot.getObjectByName('head') || characterRoot.getObjectByName('Head');
  let spineBone = characterRoot.getObjectByName('spine_02') || characterRoot.getObjectByName('spine_03') || characterRoot.getObjectByName('Spine1') || characterRoot;
  let pelvisBone = characterRoot.getObjectByName('hips') || characterRoot.getObjectByName('pelvis') || characterRoot.getObjectByName('Hips') || characterRoot;
  let rightThighBone = characterRoot.getObjectByName('thigh_r') || characterRoot.getObjectByName('UpperLeg_R') || characterRoot;
  let leftThighBone = characterRoot.getObjectByName('thigh_l') || characterRoot.getObjectByName('UpperLeg_L');

  // =========================================================================
  // A. 頭部組裝 (HELMET & OPTICS)
  // =========================================================================
  const helmetGroup = new THREE.Group();
  helmetGroup.name = 'tactical_helmet_group';
  const nvgGroup = new THREE.Group();
  nvgGroup.name = 'tactical_nvg_quad';

  if (loadoutType === 'BREACHER') {
    // 重裝防暴型：全罩式重裝防彈頭盔 + 防彈面罩 (Visor Down) + 頸部護圈
    const bHelmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.4 })
    );
    bHelmet.scale.set(1.02, 0.98, 1.18);
    bHelmet.position.set(0, 0.08, 0.02);
    helmetGroup.add(bHelmet);

    // 重型透明防彈聚碳酸酯面罩
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.145, 0.14, 16, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.6,
        ior: 1.5,
      })
    );
    visor.position.set(0, 0.02, 0.08);
    helmetGroup.add(visor);

    // 面罩加固邊框
    const visorRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.145, 0.008, 8, 16, Math.PI * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.4, metalness: 0.8 })
    );
    visorRim.rotation.x = Math.PI / 2;
    visorRim.rotation.z = -Math.PI * 0.45;
    visorRim.position.set(0, 0.09, 0.08);
    helmetGroup.add(visorRim);

  } else if (loadoutType === 'RECON') {
    // 輕量特偵型：碳纖維輕量防撞盔 + Ops-Core 抗噪拾音耳機
    const rHelmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.3 })
    );
    rHelmet.scale.set(0.98, 0.92, 1.12);
    rHelmet.position.set(0, 0.08, 0.02);
    helmetGroup.add(rHelmet);

    // 左右兩側通訊抗噪耳機
    for (const side of [-1, 1]) {
      const earMuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12),
        new THREE.MeshStandardMaterial({ color: 0x030712, roughness: 0.5, metalness: 0.5 })
      );
      earMuff.rotation.z = Math.PI / 2;
      earMuff.position.set(side * 0.145, 0.05, 0.01);
      helmetGroup.add(earMuff);
    }

  } else if (loadoutType === 'SNIPER') {
    // 暗夜狙擊型：迷彩消光盔網 + 單目微光熱成像儀
    const sHelmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.142, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a242f, roughness: 0.95, metalness: 0.05 })
    );
    sHelmet.scale.set(1.0, 0.94, 1.14);
    sHelmet.position.set(0, 0.08, 0.02);
    helmetGroup.add(sHelmet);

    // 單目熱像儀筒身 (右眼前方)
    const monoTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.024, 0.09, 12),
      new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3, metalness: 0.8 })
    );
    monoTube.rotation.x = Math.PI / 2;
    monoTube.position.set(0.045, 0.07, 0.2);
    nvgGroup.add(monoTube);

    // 熱像鏡片 (橙金高亮鍍膜)
    const heatLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.018, 12),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.85,
        roughness: 0.1,
        metalness: 0.9,
      })
    );
    heatLens.position.set(0, 0.046, 0);
    heatLens.rotation.x = -Math.PI / 2;
    monoTube.add(heatLens);
    helmetGroup.add(nvgGroup);

  } else {
    // 預設突擊先鋒型 (ASSAULT)：FAST High-Cut + GPNVG-18 四目夜視儀
    const helmetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.145, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x1c232b, roughness: 0.85, metalness: 0.15 })
    );
    helmetMesh.scale.set(1.0, 0.95, 1.15);
    helmetMesh.position.set(0, 0.08, 0.02);
    helmetGroup.add(helmetMesh);

    nvgGroup.position.set(0, 0.12, 0.16);
    const mountBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.8 })
    );
    nvgGroup.add(mountBase);

    for (let i = -1.5; i <= 1.5; i += 1) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.018, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.6 })
      );
      tube.rotation.x = Math.PI / 2;
      tube.position.set(i * 0.038, -0.02, 0.04);

      const lens = new THREE.Mesh(
        new THREE.CircleGeometry(0.015, 12),
        new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.75,
          roughness: 0.1,
          metalness: 0.9,
        })
      );
      lens.position.set(0, 0.041, 0);
      lens.rotation.x = -Math.PI / 2;
      tube.add(lens);
      nvgGroup.add(tube);
    }
    helmetGroup.add(nvgGroup);
  }

  if (headBone) {
    headBone.add(helmetGroup);
  } else {
    helmetGroup.position.set(0, 1.65, 0);
    accessoriesGroup.add(helmetGroup);
  }

  // =========================================================================
  // B. 胸身與軀幹防彈背心 (VEST & TACTICAL RIG)
  // =========================================================================
  const vestGroup = new THREE.Group();
  vestGroup.name = 'tactical_vest_group';

  if (loadoutType === 'BREACHER') {
    // 重裝型：厚重全防護 IOTV 防彈衣 + 護頸墊 + 雙聯大口徑霰彈/榴彈袋
    const heavyPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.42, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x151c24, roughness: 0.75, metalness: 0.35 })
    );
    heavyPlate.position.set(0, 0.05, 0.02);
    vestGroup.add(heavyPlate);

    // 護頸墊
    const neckCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.04, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.1 })
    );
    neckCollar.rotation.x = Math.PI / 2;
    neckCollar.position.set(0, 0.24, 0.02);
    vestGroup.add(neckCollar);

    // 重裝加厚霰彈彈鏈袋
    for (let m = -1; m <= 1; m++) {
      const shellPouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.16, 0.055),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.4 })
      );
      shellPouch.position.set(m * 0.11, 0.01, 0.16);
      vestGroup.add(shellPouch);
    }

  } else if (loadoutType === 'RECON') {
    // 輕裝型：Micro Fight 超輕量胸掛（無背部大插板，身手靈敏）
    const chestRig = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x222e3e, roughness: 0.85, metalness: 0.15 })
    );
    chestRig.position.set(0, 0.02, 0.08);
    vestGroup.add(chestRig);

    // 雙聯衝鋒槍/手槍彈匣袋
    for (let m = -1; m <= 1; m += 2) {
      const smgMag = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.16, 0.035),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.6 })
      );
      smgMag.position.set(m * 0.065, 0.01, 0.155);
      vestGroup.add(smgMag);
    }

  } else if (loadoutType === 'SNIPER') {
    // 狙擊型：消光戰術風衣胸掛 + 狙擊測距儀袋
    const sniperVest = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.32, 0.20),
      new THREE.MeshStandardMaterial({ color: 0x182029, roughness: 0.95, metalness: 0.05 })
    );
    sniperVest.position.set(0, 0.04, 0.02);
    vestGroup.add(sniperVest);

    // 測距儀與狙擊彈匣收納包
    const rangeFinderPouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x2e3846, roughness: 0.7, metalness: 0.3 })
    );
    rangeFinderPouch.position.set(0.08, 0.03, 0.13);
    vestGroup.add(rangeFinderPouch);

  } else {
    // ASSAULT 經典型：JPC 2.0 防彈背心 + 三聯裝彈匣快拔包 + 背部水袋背包
    const vestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.36, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1a222d, roughness: 0.9, metalness: 0.1 })
    );
    vestPlate.position.set(0, 0.05, 0.02);
    vestGroup.add(vestPlate);

    for (let m = -1; m <= 1; m++) {
      const mag = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, 0.14, 0.04),
        new THREE.MeshStandardMaterial({ color: 0x273549, roughness: 0.6, metalness: 0.4 })
      );
      mag.position.set(m * 0.085, 0.02, 0.13);
      vestGroup.add(mag);
    }

    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.34, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x161e27, roughness: 0.85, metalness: 0.2 })
    );
    backpack.position.set(0, 0.06, -0.16);
    vestGroup.add(backpack);
  }

  if (spineBone) {
    spineBone.add(vestGroup);
  } else {
    vestGroup.position.set(0, 1.15, 0);
    accessoriesGroup.add(vestGroup);
  }

  // =========================================================================
  // C. 次級動態配件：無線電長天線 (MEDIUM - 彈性物理彎曲)
  // =========================================================================
  const antennaGeo = new THREE.CylinderGeometry(0.005, 0.007, loadoutType === 'RECON' ? 0.35 : 0.48, 8);
  antennaGeo.translate(0, 0.24, 0);
  const radioAntenna = new THREE.Mesh(
    antennaGeo,
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 })
  );
  radioAntenna.position.set(-0.16, 0.22, -0.16);
  vestGroup.add(radioAntenna);

  secondaryMgr.registerNode(radioAntenna, {
    name: 'Radio_Antenna',
    category: 'MEDIUM',
    stiffness: loadoutType === 'BREACHER' ? 95 : 75,
    damping: 6.5,
    mass: 0.6,
    maxAngleRad: 0.42,
    restRotation: new THREE.Euler(0.08, 0, -0.1),
    hasCollisionCapsule: true,
  });

  // =========================================================================
  // D. 次級動態配件：飲水導管 (MEDIUM - 隨步伐小幅抖動)
  // =========================================================================
  const tubeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 0.24, -0.14),
    new THREE.Vector3(0.16, 0.18, 0.0),
    new THREE.Vector3(0.14, 0.08, 0.12),
  ]);
  const hydrationGeo = new THREE.TubeGeometry(tubeCurve, 16, 0.008, 6, false);
  const hydrationTube = new THREE.Mesh(
    hydrationGeo,
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.1 })
  );
  vestGroup.add(hydrationTube);

  secondaryMgr.registerNode(hydrationTube, {
    name: 'Hydration_Tube',
    category: 'MEDIUM',
    stiffness: 85,
    damping: 8.0,
    mass: 0.4,
    maxAngleRad: 0.25,
    restRotation: new THREE.Euler(0, 0, 0),
    hasCollisionCapsule: true,
  });

  // =========================================================================
  // E. 次級動態配件：槍背帶 (HEAVY - 大幅晃動，急停前甩)
  // =========================================================================
  const slingGeo = new THREE.BoxGeometry(0.035, 0.42, 0.008);
  slingGeo.translate(0, -0.21, 0);
  const slingMesh = new THREE.Mesh(
    slingGeo,
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.1 })
  );
  slingMesh.position.set(0.14, 0.05, 0.12);
  vestGroup.add(slingMesh);

  secondaryMgr.registerNode(slingMesh, {
    name: 'Gun_Sling',
    category: 'HEAVY',
    stiffness: loadoutType === 'BREACHER' ? 55 : 42,
    damping: 3.8,
    mass: loadoutType === 'BREACHER' ? 1.6 : 1.3,
    maxAngleRad: 0.65,
    restRotation: new THREE.Euler(0.12, 0, -0.05),
    hasCollisionCapsule: true,
  });

  // =========================================================================
  // F. 次級動態配件：腰際垂掛手套與登山扣 (HEAVY - 奔跑前後甩動)
  // =========================================================================
  const hangingGloves = new THREE.Group();
  hangingGloves.name = 'hanging_gloves_carabiner';

  const carabinerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.02, 0.004, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.9 })
  );
  hangingGloves.add(carabinerRing);

  const gloveMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.14, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, metalness: 0.2 })
  );
  gloveMesh.position.set(0, -0.08, 0);
  hangingGloves.add(gloveMesh);

  hangingGloves.position.set(-0.19, 0.02, 0.08);

  if (pelvisBone) {
    pelvisBone.add(hangingGloves);
  } else {
    hangingGloves.position.set(-0.19, 0.96, 0.08);
    accessoriesGroup.add(hangingGloves);
  }

  secondaryMgr.registerNode(hangingGloves, {
    name: 'Hanging_Gloves',
    category: 'HEAVY',
    stiffness: 38,
    damping: 3.2,
    mass: 1.2,
    maxAngleRad: 0.72,
    restRotation: new THREE.Euler(0, 0, 0.1),
    hasCollisionCapsule: true,
  });

  // =========================================================================
  // G. 次級動態配件：大腿快拔手槍套 (MEDIUM - 隨步伐節奏微晃)
  // =========================================================================
  const legHolsterGroup = new THREE.Group();
  legHolsterGroup.name = 'drop_leg_holster';

  const holsterBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.7 })
  );
  legHolsterGroup.add(holsterBase);

  const pistolHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.09, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 })
  );
  pistolHandle.position.set(0, 0.07, 0.02);
  pistolHandle.rotation.x = -0.25;
  legHolsterGroup.add(pistolHandle);

  legHolsterGroup.position.set(0.11, -0.12, 0.04);

  if (rightThighBone) {
    rightThighBone.add(legHolsterGroup);
  } else {
    legHolsterGroup.position.set(0.18, 0.65, 0.04);
    accessoriesGroup.add(legHolsterGroup);
  }

  secondaryMgr.registerNode(legHolsterGroup, {
    name: 'Leg_Holster',
    category: 'MEDIUM',
    stiffness: 90,
    damping: 7.5,
    mass: 0.7,
    maxAngleRad: 0.28,
    restRotation: new THREE.Euler(0, 0, -0.05),
    hasCollisionCapsule: true,
  });

  // 若為重裝型 (BREACHER)，在左大腿額外增加加厚雜物防護副包
  const utilityPouchGroup = new THREE.Group();
  utilityPouchGroup.name = 'left_thigh_utility_pouch';
  if (loadoutType === 'BREACHER') {
    const leftPouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.16, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 })
    );
    utilityPouchGroup.add(leftPouch);
    utilityPouchGroup.position.set(-0.11, -0.12, 0.04);
    if (leftThighBone) {
      leftThighBone.add(utilityPouchGroup);
    } else {
      utilityPouchGroup.position.set(-0.18, 0.65, 0.04);
      accessoriesGroup.add(utilityPouchGroup);
    }
    secondaryMgr.registerNode(utilityPouchGroup, {
      name: 'Left_Leg_Pouch',
      category: 'MEDIUM',
      stiffness: 85,
      damping: 7.0,
      mass: 0.8,
      maxAngleRad: 0.25,
      restRotation: new THREE.Euler(0, 0, 0.05),
      hasCollisionCapsule: true,
    });
  }

  return {
    accessoriesGroup,
    helmetGroup,
    nvgGroup,
    vestGroup,
    radioAntenna,
    slingMesh,
    hydrationTube,
    legHolsterGroup,
    utilityPouchGroup,
    hangingGloves,
    loadoutType,
    secondaryMotionMgr: secondaryMgr,
  };
}
