import * as THREE from 'three';

export type GrenadeType = 'FRAG' | 'FLASH' | 'SMOKE';

export interface GrenadeConfig {
  type: GrenadeType;
  name: string;
  code: string;
  fuseTime: number;
  blastRadius: number;
  damage: number;
  description: string;
}

export const GRENADE_CONFIGS: Record<GrenadeType, GrenadeConfig> = {
  FRAG: {
    type: 'FRAG',
    name: 'M67 破片高爆手榴彈',
    code: 'M67 FRAG',
    fuseTime: 2.0,
    blastRadius: 8.5,
    damage: 185,
    description: '標準軍規球形高爆破片雷，爆發劇烈鋼珠破片與爆風，對密集敵群造成致命毀傷。',
  },
  FLASH: {
    type: 'FLASH',
    name: 'M84 散光震撼彈',
    code: 'M84 FLASH',
    fuseTime: 1.5,
    blastRadius: 12.0,
    damage: 15,
    description: '多孔金屬導氣管，爆發強烈白光盲目閃光與震耳音爆，使範圍內敵軍抱頭硬直盲目 4.5 秒。',
  },
  SMOKE: {
    type: 'SMOKE',
    name: 'M18 戰術發煙手榴彈',
    code: 'M18 SMOKE',
    fuseTime: 1.8,
    blastRadius: 6.0,
    damage: 0,
    description: '圓筒型發煙罐，落地噴發持續 14 秒的濃密戰術煙霧雲，阻斷敵人視線 (LOS) 與雷達偵測。',
  },
};

/**
 * 依據手榴彈類型動態生成外觀長相不同的 3D 細緻幾何模型
 */
export function createGrenadeMesh(type: GrenadeType): THREE.Group {
  const group = new THREE.Group();
  group.name = `grenade_${type}`;

  if (type === 'FRAG') {
    // 1. M67 破片高爆彈：墨綠色圓球體 + 金屬引信保險握把 + 紅色閃爍 LED
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 16, 14),
      new THREE.MeshStandardMaterial({
        color: 0x2e3d23, // 軍綠色
        roughness: 0.55,
        metalness: 0.45,
      })
    );
    body.scale.set(1.0, 1.18, 1.0);

    const fuzeNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.04, 12),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.3, metalness: 0.85 })
    );
    fuzeNeck.position.set(0, 0.08, 0);

    const spoonLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.11, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.4, metalness: 0.7 })
    );
    spoonLever.position.set(0.032, 0.035, 0);

    const safetyRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.016, 0.003, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.9 })
    );
    safetyRing.position.set(0.038, 0.085, 0);
    safetyRing.rotation.y = Math.PI / 2;

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    led.position.set(0, 0.1, 0);

    group.add(body, fuzeNeck, spoonLever, safetyRing, led);
  } else if (type === 'FLASH') {
    // 2. M84 散光震撼彈：銀灰色多孔圓柱管 + 青色保險拉環 + 6排排氣散光孔
    const cylinderBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.14, 16),
      new THREE.MeshStandardMaterial({
        color: 0x64748b, // 銀灰鋼
        roughness: 0.35,
        metalness: 0.85,
      })
    );

    // 六排散光泄壓孔 (深色凹槽環)
    for (let r = -2; r <= 2; r++) {
      const ringPort = new THREE.Mesh(
        new THREE.TorusGeometry(0.0385, 0.0035, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.2 })
      );
      ringPort.rotation.x = Math.PI / 2;
      ringPort.position.y = r * 0.022;
      cylinderBody.add(ringPort);
    }

    const flashLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.12, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4, metalness: 0.6 }) // 天藍色安全桿
    );
    flashLever.position.set(0.036, 0.02, 0);

    const flashCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.025, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.9 })
    );
    flashCap.position.y = 0.08;

    const brightStrobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    brightStrobe.position.set(0, 0.095, 0);

    group.add(cylinderBody, flashLever, flashCap, brightStrobe);
  } else {
    // 3. M18 戰術發煙手榴彈：平頂圓筒罐 + 黃色字樣識別圈 + 頂部排煙口
    const smokeCanister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.042, 0.16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x3f4f34, // 橄欖綠
        roughness: 0.65,
        metalness: 0.25,
      })
    );

    // 黃色識別色帶
    const yellowStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0425, 0.0425, 0.035, 16),
      new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5, metalness: 0.1 })
    );
    yellowStripe.position.y = 0.02;
    smokeCanister.add(yellowStripe);

    const smokeLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.13, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.8 })
    );
    smokeLever.position.set(0.038, 0.03, 0);

    const ventCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.025, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 })
    );
    ventCap.position.y = 0.092;

    group.add(smokeCanister, smokeLever, ventCap);
  }

  return group;
}
