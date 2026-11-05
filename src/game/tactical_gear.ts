import * as THREE from 'three';
import { SecondaryMotionManager } from './secondary_motion.ts';

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
  secondaryMotionMgr: SecondaryMotionManager;
}

/**
 * 為角色骨架建立細緻化戰術配件群組並註冊次級動態 (Secondary Motion)
 */
export function attachTacticalGear(
  characterRoot: THREE.Object3D,
  parentMotionTarget: THREE.Object3D
): TacticalGearNodes {
  const accessoriesGroup = new THREE.Group();
  accessoriesGroup.name = 'tactical_accessories_root';
  characterRoot.add(accessoriesGroup);

  const secondaryMgr = new SecondaryMotionManager(parentMotionTarget);

  // 1. 尋找關鍵骨骼節點
  let headBone = characterRoot.getObjectByName('head') || characterRoot.getObjectByName('Head');
  let spineBone = characterRoot.getObjectByName('spine_02') || characterRoot.getObjectByName('spine_03') || characterRoot.getObjectByName('Spine1') || characterRoot;
  let pelvisBone = characterRoot.getObjectByName('hips') || characterRoot.getObjectByName('pelvis') || characterRoot.getObjectByName('Hips') || characterRoot;
  let rightThighBone = characterRoot.getObjectByName('thigh_r') || characterRoot.getObjectByName('UpperLeg_R') || characterRoot;

  // -------------------------------------------------------------
  // A. 頭部組裝：FAST High-Cut 頭盔 + GPNVG-18 四目夜視儀 (RIGID 緊固件)
  // -------------------------------------------------------------
  const helmetGroup = new THREE.Group();
  helmetGroup.name = 'tactical_helmet_group';

  // 頭盔本體
  const helmetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x1c232b,
      roughness: 0.85,
      metalness: 0.15,
    })
  );
  helmetMesh.scale.set(1.0, 0.95, 1.15);
  helmetMesh.position.set(0, 0.08, 0.02);
  helmetGroup.add(helmetMesh);

  // 四目夜視儀 (GPNVG-18)
  const nvgGroup = new THREE.Group();
  nvgGroup.name = 'tactical_nvg_quad';
  nvgGroup.position.set(0, 0.12, 0.16);

  const mountBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.04, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.8 })
  );
  nvgGroup.add(mountBase);

  // 4 根夜視管 + 幽綠鏡片
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

  if (headBone) {
    headBone.add(helmetGroup);
  } else {
    helmetGroup.position.set(0, 1.65, 0);
    accessoriesGroup.add(helmetGroup);
  }

  // -------------------------------------------------------------
  // B. 胸部組裝：JPC 2.0 防彈背心 + 三聯裝彈匣袋 (RIGID)
  // -------------------------------------------------------------
  const vestGroup = new THREE.Group();
  vestGroup.name = 'tactical_vest_group';

  // 防彈背心本體插板
  const vestPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.36, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x1a222d, roughness: 0.9, metalness: 0.1 })
  );
  vestPlate.position.set(0, 0.05, 0.02);
  vestGroup.add(vestPlate);

  // 三聯裝彈匣快拔包
  for (let m = -1; m <= 1; m++) {
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.14, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x273549, roughness: 0.6, metalness: 0.4 })
    );
    mag.position.set(m * 0.085, 0.02, 0.13);
    vestGroup.add(mag);
  }

  // 背部戰術背包
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.34, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x161e27, roughness: 0.85, metalness: 0.2 })
  );
  backpack.position.set(0, 0.06, -0.16);
  vestGroup.add(backpack);

  if (spineBone) {
    spineBone.add(vestGroup);
  } else {
    vestGroup.position.set(0, 1.15, 0);
    accessoriesGroup.add(vestGroup);
  }

  // -------------------------------------------------------------
  // C. 次級動態配件 1：戰術無線電長天線 (MEDIUM - 彈性彎曲)
  // -------------------------------------------------------------
  const antennaGeo = new THREE.CylinderGeometry(0.005, 0.007, 0.48, 8);
  antennaGeo.translate(0, 0.24, 0); // 旋轉中心在底部
  const radioAntenna = new THREE.Mesh(
    antennaGeo,
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 })
  );
  radioAntenna.position.set(-0.16, 0.22, -0.16);
  vestGroup.add(radioAntenna);

  secondaryMgr.registerNode(radioAntenna, {
    name: 'Radio_Antenna',
    category: 'MEDIUM',
    stiffness: 75,
    damping: 6.5,
    mass: 0.6,
    maxAngleRad: 0.42,
    restRotation: new THREE.Euler(0.08, 0, -0.1),
    hasCollisionCapsule: true,
  });

  // -------------------------------------------------------------
  // D. 次級動態配件 2：飲水導管 (MEDIUM - 隨步伐小幅抖動)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // E. 次級動態配件 3：槍背帶 (HEAVY - 大幅晃動，急停前甩)
  // -------------------------------------------------------------
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
    stiffness: 42,
    damping: 3.8,
    mass: 1.3,
    maxAngleRad: 0.65,
    restRotation: new THREE.Euler(0.12, 0, -0.05),
    hasCollisionCapsule: true,
  });

  // -------------------------------------------------------------
  // F. 次級動態配件 4：腰際垂掛手套與登山扣 (HEAVY - 奔跑前後甩動)
  // -------------------------------------------------------------
  const hangingGloves = new THREE.Group();
  hangingGloves.name = 'hanging_gloves_carabiner';

  // 登山金屬環
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.02, 0.004, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.9 })
  );
  hangingGloves.add(ring);

  // 垂掛的手套主體
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

  // -------------------------------------------------------------
  // G. 次級動態配件 5：大腿快拔手槍套 (MEDIUM - 隨步伐節奏微晃)
  // -------------------------------------------------------------
  const legHolsterGroup = new THREE.Group();
  legHolsterGroup.name = 'drop_leg_holster';

  const holsterBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.7 })
  );
  legHolsterGroup.add(holsterBase);

  // 次要配槍（手槍握把露出）
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

  const utilityPouchGroup = new THREE.Group();

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
    secondaryMotionMgr: secondaryMgr,
  };
}
