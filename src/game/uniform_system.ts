import * as THREE from 'three';

export type UniformStyleId = 'SHADOW_BLACK' | 'ARCTIC_HEX' | 'WOODLAND_TIGER' | 'URBAN_PMC';

export interface UniformConfig {
  id: UniformStyleId;
  name: string;
  nameEn: string;
  desc: string;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  bootColor: number;
  gloveColor: number;
  kneePadColor: number;
  roughness: number;
  camoType: 'multicam_black' | 'arctic_hex' | 'woodland_tiger' | 'urban_bdu';
}

export const UNIFORM_CONFIGS: Record<UniformStyleId, UniformConfig> = {
  SHADOW_BLACK: {
    id: 'SHADOW_BLACK',
    name: '暗潮黑影特勤服',
    nameEn: 'SHADOW MULTICAM BLACK',
    desc: '高密抗撕裂黑多地迷彩排汗戰鬥服，全黑皮革戰術手套與霧面防刮作戰靴，夜港滲透專用。',
    primaryColor: 0x141820,
    secondaryColor: 0x222834,
    accentColor: 0x0f1117,
    bootColor: 0x121418,
    gloveColor: 0x181c24,
    kneePadColor: 0x1f242d,
    roughness: 0.88,
    camoType: 'multicam_black',
  },
  ARCTIC_HEX: {
    id: 'ARCTIC_HEX',
    name: '極地雪斑數碼服',
    nameEn: 'ARCTIC DIGITAL HEX',
    desc: '高對比雪白與冷灰六邊形防風 GORE-TEX 迷彩服，低溫抗寒護膝襯墊與雪地防滑靴。',
    primaryColor: 0xdde4ec,
    secondaryColor: 0x8ea0b5,
    accentColor: 0x485868,
    bootColor: 0x334155,
    gloveColor: 0x64748b,
    kneePadColor: 0x475569,
    roughness: 0.78,
    camoType: 'arctic_hex',
  },
  WOODLAND_TIGER: {
    id: 'WOODLAND_TIGER',
    name: '幽靈叢林虎斑服',
    nameEn: 'WOODLAND TIGERSTRIPE',
    desc: '經典三色虎斑抗撕裂格子布（Ripstop），深狼棕（Coyote Brown）高筒皮靴與強化手套。',
    primaryColor: 0x384a2d,
    secondaryColor: 0x24331c,
    accentColor: 0x5a452a,
    bootColor: 0x423220,
    gloveColor: 0x3e4a32,
    kneePadColor: 0x2e3b23,
    roughness: 0.92,
    camoType: 'woodland_tiger',
  },
  URBAN_PMC: {
    id: 'URBAN_PMC',
    name: '都市傭兵行動服',
    nameEn: 'URBAN GHOST PMC',
    desc: '現代都市承包商戰術便服，冷灰抗撕裂排汗軀幹拼接深海軍藍長褲，輕量化高機動作戰鞋。',
    primaryColor: 0x4a5568,
    secondaryColor: 0x2d3748,
    accentColor: 0x1a202c,
    bootColor: 0x1e2430,
    gloveColor: 0x334155,
    kneePadColor: 0x283142,
    roughness: 0.85,
    camoType: 'urban_bdu',
  },
};

// 紋理快取池避免重覆運算
const textureCache = new Map<UniformStyleId, THREE.CanvasTexture>();

/**
 * 程序化生成高精度 PBR 戰術服裝迷彩紋理 (512x512 Canvas Texture)
 */
export function generateUniformTexture(config: UniformConfig): THREE.CanvasTexture {
  if (textureCache.has(config.id)) {
    return textureCache.get(config.id)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const toRgb = (hex: number) => {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return `rgb(${r}, ${g}, ${b})`;
  };

  const pColor = toRgb(config.primaryColor);
  const sColor = toRgb(config.secondaryColor);
  const aColor = toRgb(config.accentColor);

  // 底色填充
  ctx.fillStyle = pColor;
  ctx.fillRect(0, 0, 512, 512);

  if (config.camoType === 'multicam_black') {
    // 黑多地 MultiCam Black: 漸變大色塊與不規則流體斑塊
    for (let i = 0; i < 48; i++) {
      ctx.fillStyle = i % 2 === 0 ? sColor : aColor;
      ctx.beginPath();
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const rx = 30 + Math.random() * 60;
      const ry = 15 + Math.random() * 35;
      const rot = Math.random() * Math.PI;
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (config.camoType === 'arctic_hex') {
    // 極地數碼六邊形雪斑
    const hexSize = 24;
    const h = hexSize * Math.sqrt(3);
    for (let y = 0; y < 512 + h; y += h) {
      for (let x = 0; x < 512 + hexSize * 3; x += hexSize * 3) {
        const drawHex = (hx: number, hy: number, color: string) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const angle = (Math.PI / 3) * k;
            const px = hx + (hexSize - 1) * Math.cos(angle);
            const py = hy + (hexSize - 1) * Math.sin(angle);
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        };

        const rnd = Math.random();
        if (rnd > 0.45) {
          drawHex(x, y, rnd > 0.72 ? aColor : sColor);
        }
        if (rnd < 0.35) {
          drawHex(x + hexSize * 1.5, y + h / 2, rnd < 0.18 ? pColor : sColor);
        }
      }
    }
  } else if (config.camoType === 'woodland_tiger') {
    // 虎斑迷彩 (Tigerstripe): 水平流動刷痕與條紋
    for (let y = 0; y < 512; y += 18) {
      ctx.fillStyle = (y / 18) % 2 === 0 ? sColor : aColor;
      ctx.beginPath();
      ctx.moveTo(0, y);
      let cx = 0;
      while (cx < 512) {
        cx += 20 + Math.random() * 40;
        const cy = y + (Math.random() - 0.5) * 22;
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(512, y + 14);
      ctx.lineTo(0, y + 14);
      ctx.closePath();
      ctx.fill();
    }
  } else if (config.camoType === 'urban_bdu') {
    // 都市幾何數碼 PMC 拼接塊
    const blockSize = 32;
    for (let bx = 0; bx < 512; bx += blockSize) {
      for (let by = 0; by < 512; by += blockSize) {
        const roll = Math.random();
        if (roll > 0.6) {
          ctx.fillStyle = roll > 0.82 ? aColor : sColor;
          ctx.fillRect(bx, by, blockSize, blockSize);
        }
      }
    }
  }

  // 疊加防撕裂微觀織物格子線 (Micro Ripstop Grid)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  const gridStep = 8;
  ctx.beginPath();
  for (let g = 0; g <= 512; g += gridStep) {
    ctx.moveTo(g, 0);
    ctx.lineTo(g, 512);
    ctx.moveTo(0, g);
    ctx.lineTo(512, g);
  }
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4); // 在全身布料上適度重複
  textureCache.set(config.id, texture);

  return texture;
}

/**
 * 將指定特戰作戰服設計精準應用至士兵模型
 * 依據不同部位材質 (身軀長褲、作戰靴頭套、手套手臂、護膝) 分層著色
 */
export function applyUniformToModel(modelRoot: THREE.Object3D, uniformId: UniformStyleId) {
  const config = UNIFORM_CONFIGS[uniformId] || UNIFORM_CONFIGS.SHADOW_BLACK;
  const camoTex = generateUniformTexture(config);

  modelRoot.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((mat) => {
      const stdMat = mat as THREE.MeshStandardMaterial;
      const matName = stdMat.name || '';

      // 1. 作戰服身軀與戰鬥長褲 (MI_Tactical_Camo_Uniform 或包含 Camo / Uniform)
      if (matName.includes('Camo') || matName.includes('Uniform') || matName === 'M_Main') {
        stdMat.map = camoTex;
        stdMat.color.setHex(0xffffff); // 讓貼圖完整呈現原色
        stdMat.roughness = config.roughness;
        stdMat.metalness = 0.08;
        stdMat.needsUpdate = true;
      }
      // 2. 作戰靴、防風頭套、槍套腰帶 (MI_Tactical_Balaclava_Boots)
      else if (matName.includes('Balaclava') || matName.includes('Boots') || matName.includes('Holster')) {
        stdMat.color.setHex(config.bootColor);
        stdMat.roughness = 0.72;
        stdMat.metalness = 0.15;
        stdMat.needsUpdate = true;
      }
      // 3. 戰術手套與小臂 (MI_CC0_Skin_Hands_Forearms)
      else if (matName.includes('Skin') || matName.includes('Hands') || matName.includes('Arms')) {
        stdMat.color.setHex(config.gloveColor);
        stdMat.roughness = 0.65;
        stdMat.metalness = 0.2;
        stdMat.needsUpdate = true;
      }
      // 4. 防彈護膝與頭盔主體 (MI_Ballistic_Helmet_OD)
      else if (matName.includes('KneePad') || matName.includes('Helmet')) {
        stdMat.color.setHex(config.kneePadColor);
        stdMat.roughness = 0.6;
        stdMat.metalness = 0.3;
        stdMat.needsUpdate = true;
      }
    });
  });
}
