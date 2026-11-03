import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import blueprint from '../blueprints/night_port.json';
import { GameScreensManager } from './game/screens.ts';
import { SquadManager, SquadOrder } from './game/soldier.ts';
import { InfiltrationDirector, EvacuationDirector } from './game/cinematics.ts';
import {
  loadProgression,
  saveProgression,
  addWeaponExp,
  equipAttachment,
  unequipAttachment,
  calculateWeaponEffectiveStats,
  getAttachmentComparison,
  ATTACHMENTS_CATALOG,
} from './game/progression.ts';
import { WeaponsAttachmentVisualizer, PictureInPictureScope } from './game/weapons.ts';
import { WorldDetailsManager } from './world/details.ts';
import { tacticalRadioAudio } from './game/audio.ts';

interface WeaponSpec {
  id: string;
  slot: number;
  name: string;
  category: string;
  desc: string;
  nodeName: string;
  fireMode: 'AUTO' | 'BURST' | 'SEMI' | 'PUMP' | 'BOLT' | 'ROCKET';
  supportedModes?: ('AUTO' | 'BURST' | 'SEMI')[];
  pellets?: number;
  spreadRad?: number;
  hasGreenLaser?: boolean;
  damage: number;
  headshotMult: number;
  fireInterval: number;
  reloadTime: number;
  magSize: number;
  mag: number;
  reserve: number;
  recoilPitch: number;
  recoilZ: number;
  adsFov: number;
  stats: { dmg: number; rof: number; stb: number; rng: number; cap: number };
  audioShot: string;
  silhouette: string;
}

const WEAPONS: WeaponSpec[] = [
  {
    id: 'ar7',
    slot: 1,
    name: 'AR-7 カービン',
    category: 'ASSAULT RIFLE / アサルトライフル',
    desc: '現代模組化突擊卡賓槍。配備全息反射瞄準鏡、M-LOK 護木與垂直前握把，支援 [B] 切換全自動 / 三連發 / 半自動射擊模式。',
    nodeName: 'AR7_Carbine',
    fireMode: 'AUTO',
    supportedModes: ['AUTO', 'BURST', 'SEMI'],
    damage: 34,
    headshotMult: 2.2,
    fireInterval: 0.105,
    reloadTime: 1.55,
    magSize: 36,
    mag: 36,
    reserve: 144,
    recoilPitch: 0.016,
    recoilZ: 0.038,
    adsFov: 44,
    stats: { dmg: 48, rof: 82, stb: 78, rng: 68, cap: 36 },
    audioShot: 'assets/audio/ar7_shot.wav',
    silhouette: '︻╦╤─',
  },
  {
    id: 'smg9',
    slot: 2,
    name: 'SMG-9 タクティカル',
    category: 'SUBMACHINE GUN / サブマシンガン',
    desc: '配備整合式滅音管與 PEQ-15 綠光雷射指示器的高射速戰術衝鋒槍。880 RPM 極高連射與極低後座力，適合港口貨櫃巷弄突入作戰。',
    nodeName: 'SMG9_Tactical',
    fireMode: 'AUTO',
    supportedModes: ['AUTO', 'BURST', 'SEMI'],
    hasGreenLaser: true,
    damage: 25,
    headshotMult: 2.0,
    fireInterval: 0.068,
    reloadTime: 1.32,
    magSize: 45,
    mag: 45,
    reserve: 180,
    recoilPitch: 0.010,
    recoilZ: 0.024,
    adsFov: 48,
    stats: { dmg: 34, rof: 96, stb: 88, rng: 46, cap: 45 },
    audioShot: 'assets/audio/smg9_shot.wav',
    silhouette: '╤╦═─',
  },
  {
    id: 'sg12',
    slot: 3,
    name: 'SG-12 ブリーチャー',
    category: 'SHOTGUN / タクティカルショットガン',
    desc: '半自動戰術破門霰彈槍。配備開孔散熱護罩與側邊彈殼架，單發同時擊發 8 顆鹿彈 (Buckshot)，近距離具備毀滅性制止力。',
    nodeName: 'SG12_Shotgun',
    fireMode: 'PUMP',
    pellets: 8,
    spreadRad: 0.042,
    damage: 19,
    headshotMult: 1.75,
    fireInterval: 0.42,
    reloadTime: 1.85,
    magSize: 8,
    mag: 8,
    reserve: 40,
    recoilPitch: 0.048,
    recoilZ: 0.078,
    adsFov: 50,
    stats: { dmg: 92, rof: 34, stb: 46, rng: 28, cap: 8 },
    audioShot: 'assets/audio/sg12_shot.wav',
    silhouette: '═╦═══',
  },
  {
    id: 'sr9',
    slot: 4,
    name: 'SR-9 スナイパー',
    category: 'SNIPER / ボルトアクション',
    desc: 'ボルトアクションの狙撃銃。一発で倒せるが、撃つたびに装填が要る。配備 8 倍光學測距狙擊鏡與折疊雙腳架。',
    nodeName: 'SR9_Sniper',
    fireMode: 'BOLT',
    damage: 115,
    headshotMult: 2.5,
    fireInterval: 1.05,
    reloadTime: 2.1,
    magSize: 5,
    mag: 5,
    reserve: 25,
    recoilPitch: 0.055,
    recoilZ: 0.085,
    adsFov: 16,
    stats: { dmg: 95, rof: 15, stb: 55, rng: 98, cap: 5 },
    audioShot: 'assets/audio/sr9_shot.wav',
    silhouette: '︻╦══╤──',
  },
  {
    id: 'rl7',
    slot: 5,
    name: 'RL-7 ロケット',
    category: 'LAUNCHER / 対戦車ロケット',
    desc: '重型反裝甲火箭發射器。發射高爆破甲彈頭，具備大範圍爆炸衝擊波與掩體壓制能力。',
    nodeName: 'RL7_Launcher',
    fireMode: 'ROCKET',
    damage: 180,
    headshotMult: 1.2,
    fireInterval: 1.35,
    reloadTime: 2.4,
    magSize: 1,
    mag: 1,
    reserve: 5,
    recoilPitch: 0.075,
    recoilZ: 0.11,
    adsFov: 48,
    stats: { dmg: 100, rof: 10, stb: 40, rng: 75, cap: 1 },
    audioShot: 'assets/audio/rl7_shot.wav',
    silhouette: '══███══',
  },
];

interface EnemyActor {
  id: string;
  name: string;
  archetype: 'ASSAULT' | 'SNIPER' | 'BREACHER' | 'JUGGERNAUT';
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  activeClip: string;
  hp: number;
  maxHp: number;
  state: 'PATROL' | 'ALERT' | 'COMBAT' | 'COVER' | 'HIT' | 'DEAD';
  stateTimer: number;
  fireCooldown: number;
  patrolPoints: [number, number][];
  patrolIdx: number;
  baseY: number;
  muzzleFlash: THREE.Mesh;
  laserLine?: THREE.Line;
  statusSprite?: THREE.Sprite;
  hpFillMesh?: THREE.Mesh;
  hpBarGroup?: THREE.Group;
  shieldGroup?: THREE.Group;
  isStaggered?: boolean;
  staggerTimer?: number;
}

interface SuspendedCargoDrop {
  group: THREE.Group;
  shackleMesh: THREE.Mesh;
  cableLine: THREE.Line;
  state: 'SUSPENDED' | 'FALLING' | 'LANDED';
  velY: number;
  colliderAdded: boolean;
}

interface LootDrop {
  mesh: THREE.Group;
  position: THREE.Vector3;
  age: number;
  collected: boolean;
}

interface ExplosiveBarrel {
  id: string;
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  wreckGroup: THREE.Group;
  hp: number;
  exploded: boolean;
}

interface ExplosionDebris {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotSpeed: THREE.Vector3;
}

interface ActiveExplosion {
  group: THREE.Group;
  core: THREE.Mesh;
  innerCore: THREE.Mesh;
  plume: THREE.Mesh;
  secondaryPlume: THREE.Mesh;
  shockwave: THREE.Mesh;
  blastLight: THREE.PointLight;
  debris: ExplosionDebris[];
  age: number;
  duration: number;
}

interface ActiveRocket {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  age: number;
  smokeTimer: number;
}

interface ActiveShell {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  age: number;
}

interface ActiveTracer {
  line: THREE.Line;
  age: number;
}

interface ActiveSmokePuff {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

interface ActiveGrenade {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  age: number;
  fuseTime: number;
  bounced: boolean;
}

const urlParams = new URLSearchParams(window.location.search);
const captureMode = urlParams.has('capture');
const initialCamParam = urlParams.get('cam');
const initialUiParam = urlParams.get('ui');

const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.42;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#091322');
scene.fog = new THREE.FogExp2('#0e1c30', 0.0075);

// Generate Real-time Night Harbor PMREM Environment Map for PBR Metallic/Wet Specular Reflections
const pmremGen = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.background = new THREE.Color('#13243b');
const envSkyLight = new THREE.HemisphereLight(0x6b96c8, 0x382818, 2.8);
envScene.add(envSkyLight);
// Add warm sodium lamp globes & cool crane lights into the PMREM bake scene so puddles & wet asphalt reflect realistic harbor light pools!
const envLights: [number, number, number, number, number][] = [
  [12, 8, -10, 0xffaa44, 5.5],
  [-14, 9, 14, 0xff9e3d, 5.0],
  [0, 12, 18, 0xffb85c, 4.5],
  [-24, 15, -18, 0x7cb6ff, 4.0],
  [-4, 4, 22, 0xff6a1a, 3.8],
];
for (const [ex, ey, ez, col, rad] of envLights) {
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(rad, 14, 10),
    new THREE.MeshBasicMaterial({ color: col })
  );
  orb.position.set(ex, ey, ez);
  envScene.add(orb);
}
scene.environment = pmremGen.fromScene(envScene, 0.035).texture;
scene.environmentIntensity = 1.75;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.08, 220);
scene.add(camera);

// ---------------------------------------------------------------------------
// Spatial Web Audio System (Step 7)
// ---------------------------------------------------------------------------
class SpatialAudioManager {
  ctx: AudioContext | null = null;
  buffers: Map<string, AudioBuffer> = new Map();
  masterVolume = 0.75;

  async unlockAndPreload() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
    const files = [
      'assets/audio/ar7_shot.wav',
      'assets/audio/smg9_shot.wav',
      'assets/audio/sg12_shot.wav',
      'assets/audio/sr9_shot.wav',
      'assets/audio/rl7_shot.wav',
      'assets/audio/explosion.wav',
      'assets/audio/reload.wav',
      'assets/audio/grenade_bounce.wav',
      'assets/audio/fire_mode_click.wav',
      'assets/audio/impact_metal.wav',
      'assets/audio/impact_concrete.wav',
      'assets/audio/impact_water.wav',
      'assets/audio/footstep_concrete.wav',
      'assets/audio/footstep_metal.wav',
      'assets/audio/harbor_ambience_loop.wav',
      'assets/audio/radio_chatter.wav',
    ];
    await Promise.all(
      files.map(async (url) => {
        if (this.buffers.has(url) || !this.ctx) return;
        return new Promise<void>((resolve) => {
          const timer = setTimeout(() => resolve(), 150);
          fetch(url)
            .then((res) => res.arrayBuffer())
            .then((arr) => this.ctx?.decodeAudioData(arr))
            .then((buf) => {
              if (buf) this.buffers.set(url, buf);
            })
            .catch(() => {})
            .finally(() => {
              clearTimeout(timer);
              resolve();
            });
        });
      })
    );
  }

  play2D(url: string, gain = 0.7) {
    if (!this.ctx || !this.buffers.has(url)) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get(url)!;
    const g = this.ctx.createGain();
    g.gain.value = gain * this.masterVolume;
    src.connect(g).connect(this.ctx.destination);
    src.start();
  }

  play3D(url: string, pos: THREE.Vector3, listenerPos: THREE.Vector3, refDist = 6, maxDist = 55, gain = 0.85) {
    if (!this.ctx || !this.buffers.has(url)) return;
    const dist = pos.distanceTo(listenerPos);
    if (dist > maxDist) return;
    const atten = Math.max(0.05, Math.min(1, refDist / Math.max(refDist, dist)));
    this.play2D(url, gain * atten);
  }
}
const audioSys = new SpatialAudioManager();

// ---------------------------------------------------------------------------
// Night Port Atmosphere, Sky Dome, Lights & Volumetric Cones (Step 5)
// ---------------------------------------------------------------------------
let moonLight: THREE.DirectionalLight;

function buildAtmosphereAndLights() {
  // 1. Stormy Night Sky Dome & Distant Harbor Mountain Silhouette
  const skyGeo = new THREE.SphereGeometry(175, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#050a14') },
      midColor: { value: new THREE.Color('#13243b') },
      horizonColor: { value: new THREE.Color('#1e3148') },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        float cloud = sin(vWorldPos.x * 0.045) * cos(vWorldPos.z * 0.045) * 0.5 + 0.5;
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, max(0.0, h)));
        col = mix(col, topColor, smoothstep(0.25, 0.85, max(0.0, h)));
        col += vec3(0.04, 0.06, 0.09) * cloud * smoothstep(0.05, 0.45, h);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // 2. Ambient Hemisphere & Moonlight Directional with Shadows
  const hemi = new THREE.HemisphereLight(0x749fd1, 0x2b241c, 1.85);
  scene.add(hemi);

  moonLight = new THREE.DirectionalLight(0x9ec2ec, 2.35);
  moonLight.position.set(-28, 42, 24);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.near = 2;
  moonLight.shadow.camera.far = 115;
  const d = 44;
  moonLight.shadow.camera.left = -d;
  moonLight.shadow.camera.right = d;
  moonLight.shadow.camera.top = d;
  moonLight.shadow.camera.bottom = -d;
  moonLight.shadow.bias = -0.0005;
  scene.add(moonLight);

  // Secondary fill directional from harbor cranes
  const craneFill = new THREE.DirectionalLight(0xffb466, 1.15);
  craneFill.position.set(22, 28, 18);
  scene.add(craneFill);

  // 3. Pre-allocated Sodium Port Floodlights + Soft Volumetric God-Ray Shader Cones (Zero hard edges!)
  const coneGeo = new THREE.ConeGeometry(4.6, 11.2, 24, 1, true);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      beamColor: { value: new THREE.Color(0xffb454) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 beamColor;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(abs(dot(vNormalW, viewDir)), 1.9);
        // vUv.y is 1 at apex (lamp head) and 0 at bottom ground
        float vertFade = smoothstep(0.0, 0.75, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
        float coreGlow = pow(vUv.y, 1.8) * 0.08;
        float alpha = (fresnel * 0.085 * vertFade) + coreGlow;
        gl_FragColor = vec4(beamColor, alpha);
      }
    `,
  });

  const sodiumPositions: [number, number, number, number][] = [
    [-12.0, 11.0, 20.0, 38],
    [-12.0, 11.0, 2.0, 38],
    [11.5, 11.0, 21.0, 38],
    [11.5, 11.0, 4.0, 38],
    [11.5, 11.0, -14.0, 38],
    [-7.5, 19.5, -22.0, 46], // Gantry Crane Overhead Floodlight
    [19.0, 8.0, -8.0, 34],    // Warehouse Interior Light
  ];

  // Radial Atmospheric Halo Texture for Sodium Floodlights & Buoys
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 64;
  haloCanvas.height = 64;
  const hCtx = haloCanvas.getContext('2d')!;
  const grad = hCtx.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 225, 165, 0.95)');
  grad.addColorStop(0.28, 'rgba(255, 165, 70, 0.45)');
  grad.addColorStop(0.65, 'rgba(255, 130, 40, 0.12)');
  grad.addColorStop(1, 'rgba(255, 110, 20, 0.0)');
  hCtx.fillStyle = grad;
  hCtx.fillRect(0, 0, 64, 64);
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex,
    color: 0xffb858,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  for (const [lx, ly, lz, range] of sodiumPositions) {
    const pt = new THREE.PointLight(0xffae4c, 45, range, 1.45);
    pt.position.set(lx, ly, lz);
    scene.add(pt);

    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(lx, ly - 5.5, lz);
    scene.add(cone);

    const halo = new THREE.Sprite(haloMat);
    halo.position.set(lx, ly - 0.1, lz);
    halo.scale.set(5.2, 5.2, 1);
    scene.add(halo);
  }
}

// Fire Barrels: Volumetric Flickering Shader Flames + Rising Ember Sparks + Night Rain Streaks
const fireLights: THREE.PointLight[] = [];
const fireFlames: THREE.Mesh[] = [];
const fireShaderMats: THREE.ShaderMaterial[] = [];
let emberParticles: THREE.Points | null = null;
let rainLines: THREE.LineSegments | null = null;

function setupFireBarrels() {
  const coords: [number, number][] = [
    [-3.2, 25.5], [-4.8, 9.5], [4.5, -1.5], [-8.0, -15.0], [15.0, 11.0],
  ];
  const flamePlaneGeo = new THREE.PlaneGeometry(0.85, 1.15, 6, 10);

  coords.forEach(([fx, fz], idx) => {
    const fl = new THREE.PointLight(0xff6818, 16, 16, 1.65);
    fl.position.set(fx, 1.5, fz);
    scene.add(fl);
    fireLights.push(fl);

    const fMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 1.5 + idx * 1.3 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float sway = sin(uTime * 6.5 + uv.y * 5.0) * 0.08 * uv.y;
          pos.x += sway;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float dx = abs(vUv.x - 0.5) * 2.0;
          float wave = sin(vUv.y * 10.0 - uTime * 9.0) * 0.14 * vUv.y;
          float width = (1.0 - vUv.y * 0.78) + wave;
          float mask = smoothstep(width, width * 0.2, dx);
          float vFade = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
          float alpha = mask * vFade;
          vec3 innerCol = vec3(1.0, 0.92, 0.55);
          vec3 outerCol = vec3(1.0, 0.32, 0.04);
          vec3 col = mix(outerCol, innerCol, smoothstep(0.65, 0.0, dx) * (1.0 - vUv.y * 0.6));
          gl_FragColor = vec4(col, alpha * 0.92);
        }
      `,
    });
    fireShaderMats.push(fMat);

    const flameGroup = new THREE.Group();
    flameGroup.position.set(fx, 1.38, fz);
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(flamePlaneGeo, fMat);
      p.rotation.y = (k * Math.PI) / 3;
      flameGroup.add(p);
    }
    scene.add(flameGroup);
    fireFlames.push(flameGroup as unknown as THREE.Mesh);
  });

  // Rising Ember Sparks above all 5 Fire Barrels (Single Points Draw Call!)
  const sparkCount = 120;
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    const [bx, bz] = coords[i % coords.length];
    const h = (i / sparkCount) * 2.6;
    const angle = i * 2.399;
    const rad = 0.08 + (i % 7) * 0.035;
    sparkPos[i * 3] = bx + Math.cos(angle) * rad;
    sparkPos[i * 3 + 1] = 1.0 + h;
    sparkPos[i * 3 + 2] = bz + Math.sin(angle) * rad;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xffa834,
    size: 0.075,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  emberParticles = new THREE.Points(sparkGeo, sparkMat);
  scene.add(emberParticles);

  // Night Rain Streak Lines across the Harbor (Single LineSegments Draw Call!)
  const rainDrops = 750;
  const rainVerts = new Float32Array(rainDrops * 6);
  for (let i = 0; i < rainDrops; i++) {
    const rx = ((i * 73) % 64) - 30;
    const ry = ((i * 41) % 24) + 0.5;
    const rz = ((i * 97) % 68) - 32;
    rainVerts[i * 6] = rx;
    rainVerts[i * 6 + 1] = ry;
    rainVerts[i * 6 + 2] = rz;
    rainVerts[i * 6 + 3] = rx - 0.08;
    rainVerts[i * 6 + 4] = ry - 0.85;
    rainVerts[i * 6 + 5] = rz + 0.04;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainVerts, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x8cb4dc,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  rainLines = new THREE.LineSegments(rainGeo, rainMat);
  scene.add(rainLines);
}

// ---------------------------------------------------------------------------
// Tactical Stealth Helicopter (MH-60 Blackhawk / Stealth Little Bird)
// ---------------------------------------------------------------------------
function createStealthHelicopter() {
  const group = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({
    color: 0x141a24,
    metalness: 0.85,
    roughness: 0.35,
  });
  const matRotor = new THREE.MeshStandardMaterial({
    color: 0x0a0d12,
    metalness: 0.9,
    roughness: 0.2,
  });
  const matGlass = new THREE.MeshStandardMaterial({
    color: 0x0f2027,
    metalness: 0.95,
    roughness: 0.1,
    transparent: true,
    opacity: 0.65,
  });

  // Fuselage (chiseled stealth body)
  const bodyGeo = new THREE.BoxGeometry(2.2, 2.0, 7.5);
  const bodyMesh = new THREE.Mesh(bodyGeo, matBody);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Cockpit Nose (slanted)
  const noseGeo = new THREE.ConeGeometry(1.3, 2.5, 4);
  noseGeo.rotateX(-Math.PI / 2);
  noseGeo.rotateY(Math.PI / 4);
  const noseMesh = new THREE.Mesh(noseGeo, matGlass);
  noseMesh.position.set(0, -0.15, -4.6);
  group.add(noseMesh);

  // Tail Boom
  const tailGeo = new THREE.CylinderGeometry(0.35, 0.6, 6.2, 6);
  tailGeo.rotateX(Math.PI / 2);
  const tailMesh = new THREE.Mesh(tailGeo, matBody);
  tailMesh.position.set(0, 0.45, 5.8);
  group.add(tailMesh);

  // Vertical Tail Fin
  const finGeo = new THREE.BoxGeometry(0.18, 1.8, 1.2);
  const finMesh = new THREE.Mesh(finGeo, matBody);
  finMesh.position.set(0, 1.2, 8.6);
  group.add(finMesh);

  // Main Rotor Hub & 4 Blades
  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 1.45, -0.4);
  const hubGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.5, 8);
  mainRotor.add(new THREE.Mesh(hubGeo, matRotor));
  for (let b = 0; b < 4; b++) {
    const bladeGeo = new THREE.BoxGeometry(0.35, 0.05, 5.8);
    const bladeMesh = new THREE.Mesh(bladeGeo, matRotor);
    bladeMesh.rotation.y = (b * Math.PI) / 2;
    bladeMesh.position.set(
      Math.sin((b * Math.PI) / 2) * 2.8,
      0.15,
      Math.cos((b * Math.PI) / 2) * 2.8
    );
    mainRotor.add(bladeMesh);
  }
  group.add(mainRotor);

  // Tail Rotor Hub & 2 Blades
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.35, 1.6, 8.8);
  tailRotor.rotation.z = Math.PI / 2;
  const tHubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.25, 6);
  tailRotor.add(new THREE.Mesh(tHubGeo, matRotor));
  const tBladeGeo = new THREE.BoxGeometry(0.18, 0.04, 1.6);
  tailRotor.add(new THREE.Mesh(tBladeGeo, matRotor));
  group.add(tailRotor);

  // Landing Skids
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.8, roughness: 0.3 });
  for (const sx of [-1.25, 1.25]) {
    const skidGeo = new THREE.CylinderGeometry(0.08, 0.08, 5.5, 6);
    skidGeo.rotateX(Math.PI / 2);
    const skid = new THREE.Mesh(skidGeo, skidMat);
    skid.position.set(sx, -1.35, -0.4);
    group.add(skid);

    for (const sz of [-1.5, 1.2]) {
      const strutGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6);
      const strut = new THREE.Mesh(strutGeo, skidMat);
      strut.position.set(sx * 0.75, -1.0, sz);
      strut.rotation.z = (sx > 0 ? -1 : 1) * 0.45;
      group.add(strut);
    }
  }

  // Interior Jump Cabin Point Light
  const cabinLight = new THREE.PointLight(0xff2222, 3.5, 8);
  cabinLight.position.set(0, 0.2, 0.5);
  group.add(cabinLight);

  // Nose-Mounted Tactical FLIR Searchlight Beam pointing downward
  const searchLight = new THREE.SpotLight(0xfff5ea, 12.0, 52, Math.PI / 5, 0.45);
  searchLight.position.set(0, -0.6, -3.8);
  const searchTarget = new THREE.Object3D();
  searchTarget.position.set(0, -14, -18);
  group.add(searchTarget);
  searchLight.target = searchTarget;
  group.add(searchLight);

  // Wingtip Navigation Strobes (Red on Left, Green on Right)
  const leftStrobe = new THREE.PointLight(0xff2222, 2.5, 12);
  leftStrobe.position.set(-1.8, 0.2, 0.2);
  const rightStrobe = new THREE.PointLight(0x22c55e, 2.5, 12);
  rightStrobe.position.set(1.8, 0.2, 0.2);
  group.add(leftStrobe, rightStrobe);

  return {
    group,
    mainRotor,
    tailRotor,
    cabinLight,
    searchLight,
    update(dt: number, pos: THREE.Vector3, rotY: number, pitch: number, lightColor: THREE.Color) {
      group.position.copy(pos);
      group.rotation.y = rotY;
      group.rotation.x = pitch;
      mainRotor.rotation.y += dt * 44;
      tailRotor.rotation.x += dt * 48;
      cabinLight.color.copy(lightColor);
      const strobeOn = Math.sin(performance.now() * 0.008) > 0.15;
      leftStrobe.intensity = strobeOn ? 2.5 : 0.2;
      rightStrobe.intensity = strobeOn ? 2.5 : 0.2;
    },
  };
}
let stealthHeli: ReturnType<typeof createStealthHelicopter> | null = null;
let operationStarted = false;

function launchInfiltrationCutscene() {
  operationStarted = true;
  screensMgr.hidePortal();
  if (stealthHeli) stealthHeli.group.visible = true;
  infiltrationDirector.play(() => {
    if (playerTpsRoot) playerTpsRoot.visible = false;
    fpRig.visible = true;
    if (stealthHeli) stealthHeli.group.visible = false;
    audioSys.play2D('assets/audio/radio_chatter.wav', 0.85);
    audioSys.play2D('assets/audio/fire_mode_click.wav', 0.85);
    showKillBanner('TACTICAL INSERTION CONFIRMED // FREE TO ENGAGE');
  });
}

// ---------------------------------------------------------------------------
// Tactical Props (Jersey Barriers, Mooring Bollards, Ammo Crates & Caution Markings)
// ---------------------------------------------------------------------------
function setupTacticalPropsAndMarkings() {
  // 1. Heavy Steel Mooring Bollards along water edge with mooring cables
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x1c2128, metalness: 0.85, roughness: 0.3 });
  const cableMat = new THREE.LineBasicMaterial({ color: 0x2d3748 });
  const bollardGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.85, 12);
  const capGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.15, 12);

  const bZcoords = [-16, -6, 4, 14, 24, 32];
  bZcoords.forEach((bz) => {
    const bg = new THREE.Group();
    bg.position.set(-17.2, 0.42, bz);
    const bMesh = new THREE.Mesh(bollardGeo, bollardMat);
    bMesh.castShadow = true;
    bg.add(bMesh);
    const cMesh = new THREE.Mesh(capGeo, bollardMat);
    cMesh.position.y = 0.45;
    bg.add(cMesh);
    scene.add(bg);

    // Mooring steel cable connecting to cargo ship hull
    const cableGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-17.2, 0.8, bz),
      new THREE.Vector3(-24.5, 3.8, bz - 2.5),
    ]);
    const cable = new THREE.Line(cableGeo, cableMat);
    scene.add(cable);
  });

  // 2. Yellow/Black Caution Edge Stripes along Dock Quay
  const stripeCanvas = document.createElement('canvas');
  stripeCanvas.width = 128;
  stripeCanvas.height = 16;
  const sCtx = stripeCanvas.getContext('2d')!;
  sCtx.fillStyle = '#facc15';
  sCtx.fillRect(0, 0, 128, 16);
  sCtx.fillStyle = '#1e293b';
  for (let i = -16; i < 140; i += 24) {
    sCtx.beginPath();
    sCtx.moveTo(i, 0);
    sCtx.lineTo(i + 14, 0);
    sCtx.lineTo(i + 4, 16);
    sCtx.lineTo(i - 10, 16);
    sCtx.closePath();
    sCtx.fill();
  }
  const stripeTex = new THREE.CanvasTexture(stripeCanvas);
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.repeat.set(18, 1);
  const stripeMat = new THREE.MeshStandardMaterial({
    map: stripeTex,
    roughness: 0.8,
    metalness: 0.1,
  });
  const stripeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 54), stripeMat);
  stripeMesh.rotation.x = -Math.PI / 2;
  stripeMesh.position.set(-17.0, 0.02, 8.0);
  scene.add(stripeMesh);

  // 3. Concrete Jersey Barriers & Stacked Ammo Crates / Pallets
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, metalness: 0.05 });
  const palletMat = new THREE.MeshStandardMaterial({ color: 0x785633, roughness: 0.85, metalness: 0.05 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x33442a, roughness: 0.75, metalness: 0.2 });

  const barrierPositions = [
    [-8.8, 19.8, 0],
    [-8.8, 22.8, 0],
    [1.8, 12.5, Math.PI / 2],
    [5.0, 12.5, Math.PI / 2],
    [-2.5, 4.5, 0.3],
  ];
  barrierPositions.forEach(([bx, bz, ry]) => {
    const barGeo = new THREE.BoxGeometry(0.65, 0.95, 2.8);
    const barMesh = new THREE.Mesh(barGeo, barrierMat);
    barMesh.position.set(bx, 0.48, bz);
    barMesh.rotation.y = ry;
    barMesh.castShadow = true;
    barMesh.receiveShadow = true;
    scene.add(barMesh);
  });

  const cratePositions = [
    [-9.6, 18.2], [-9.6, 17.1], [-9.6, 16.0],
    [3.2, 10.5], [4.2, 10.5], [-5.2, -1.2],
  ];
  cratePositions.forEach(([cx, cz], i) => {
    const pMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 1.2), palletMat);
    pMesh.position.set(cx, 0.08, cz);
    scene.add(pMesh);

    const cMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.65), crateMat);
    cMesh.position.set(cx, 0.44, cz);
    cMesh.rotation.y = i * 0.4;
    cMesh.castShadow = true;
    cMesh.receiveShadow = true;
    scene.add(cMesh);
  });

  // 4. Slow-Breathing Red Aviation Beacon at top of Gantry Crane
  const beaconLight = new THREE.PointLight(0xef4444, 2.5, 35);
  beaconLight.position.set(-7.5, 27.5, -22.0);
  scene.add(beaconLight);

  const beaconGeo = new THREE.SphereGeometry(0.35, 8, 8);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.copy(beaconLight.position);
  scene.add(beaconMesh);
}

// ---------------------------------------------------------------------------
// Dynamic Thunderstorm Lightning & Distant Thunder Engine
// ---------------------------------------------------------------------------
let lightningTimer = 14.0;
let lightningFlashPhase = 0;
const lightningBaseIntensity = 2.35;

function updateLightningAndThunder(dt: number, moonDirLight: THREE.DirectionalLight) {
  lightningTimer -= dt;
  if (lightningTimer <= 0) {
    lightningFlashPhase = 1;
    lightningTimer = 18.0 + Math.random() * 12.0;
    setTimeout(() => {
      tacticalRadioAudio.playThunderRumble(0.68);
    }, 750 + Math.random() * 450);
  }

  if (lightningFlashPhase > 0) {
    if (lightningFlashPhase === 1) {
      moonDirLight.intensity = 8.5;
      moonDirLight.color.setHex(0xd0e6ff);
      lightningFlashPhase = 2;
    } else if (lightningFlashPhase === 2) {
      moonDirLight.intensity = 1.8;
      lightningFlashPhase = 3;
    } else if (lightningFlashPhase === 3) {
      moonDirLight.intensity = 6.2;
      lightningFlashPhase = 4;
    } else {
      moonDirLight.intensity = lightningBaseIntensity;
      moonDirLight.color.setHex(0x9ec2ec);
      lightningFlashPhase = 0;
    }
  }
}

// Dynamic Radio Narrative State
const narrativeState = {
  firstContact: false,
  sniperDown: false,
  fuelDepot: false,
  terminalHacked: false,
};


// ---------------------------------------------------------------------------
// Realistic Water & Planar Reflective Wet Puddles (Three.js Water.js + Fresnel Rain Ripple Shader)
// ---------------------------------------------------------------------------
let harborSeaWater: Water | null = null;
let puddleShaderMat: THREE.ShaderMaterial | null = null;
const groundReflectionRT = new THREE.WebGLRenderTarget(384, 384, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
});
const groundMirrorCamera = new THREE.PerspectiveCamera();
const groundTexMatrix = new THREE.Matrix4();
const puddleMeshes: THREE.Mesh[] = [];
let reflectionFrameTick = 0;

function createProceduralWaterNormalsTexture(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const h =
        Math.sin(u * 2.0 + v * 1.0) * 0.35 +
        Math.cos(u * 3.0 - v * 4.0) * 0.25 +
        Math.sin(u * 7.0 + v * 5.0) * 0.18 +
        Math.cos(u * 11.0 - v * 9.0) * 0.12 +
        Math.sin(u * 16.0 + v * 13.0) * 0.08;
      heights[y * size + x] = h;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = heights[y * size + ((x - 1 + size) % size)];
      const hR = heights[y * size + ((x + 1) % size)];
      const hD = heights[((y - 1 + size) % size) * size + x];
      const hU = heights[((y + 1) % size) * size + x];
      const dx = (hL - hR) * 2.4;
      const dy = (hD - hU) * 2.4;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz) || 1.0;
      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const sharedWaterNormals = createProceduralWaterNormalsTexture(256);

function setupHarborWaterAndPuddles() {
  // 1. Official Three.js Water.js for West & North Harbor Sea Basin
  const seaGeo = new THREE.PlaneGeometry(76, 130);
  harborSeaWater = new Water(seaGeo, {
    textureWidth: 256,
    textureHeight: 256,
    waterNormals: sharedWaterNormals,
    sunDirection: new THREE.Vector3(-0.45, 0.78, -0.35).normalize(),
    sunColor: 0xffaa44,
    waterColor: 0x05101c,
    distortionScale: 3.4,
    fog: scene.fog !== undefined,
  });
  harborSeaWater.rotation.x = -Math.PI / 2;
  harborSeaWater.position.set(-44, -1.32, 0);
  scene.add(harborSeaWater);

  // 2. Shared Real-Time Planar Reflection + Analytical Raindrop Wave Normal Shader for Wet Dock Puddles
  puddleShaderMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      tReflection: { value: groundReflectionRT.texture },
      tNormalMap: { value: sharedWaterNormals },
      uTextureMatrix: { value: groundTexMatrix },
      uTime: { value: 1.5 },
      uCameraPos: { value: new THREE.Vector3() },
    },
    vertexShader: `
      uniform mat4 uTextureMatrix;
      varying vec4 vMirrorCoord;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vMirrorCoord = uTextureMatrix * worldPosition;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D tReflection;
      uniform sampler2D tNormalMap;
      uniform float uTime;
      uniform vec3 uCameraPos;
      varying vec4 vMirrorCoord;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      // Analytical expanding raindrop concentric wave gradient (perturb normal, never draw grey rings!)
      vec2 rainRippleGrad(vec2 p, vec2 center, float phase) {
        vec2 d = p - center;
        float r = length(d) + 1e-4;
        float waveRadius = phase * 1.45;
        float band = exp(-18.0 * (r - waveRadius) * (r - waveRadius));
        float env = (1.0 - phase) * exp(-1.6 * r);
        float slope = cos(r * 38.0 - phase * 26.0) * band * env;
        return (d / r) * slope;
      }

      void main() {
        // 1. Soft organic edge feathering using normalized radial puddle UV
        vec2 centeredUv = (vUv - vec2(0.5)) * 2.0;
        float radialDist = length(centeredUv);
        // Subtle organic boundary modulation
        float angle = atan(centeredUv.y, centeredUv.x);
        float edgeMod = 0.06 * sin(angle * 5.0 + vWorldPos.x) + 0.04 * cos(angle * 3.0 - vWorldPos.z);
        float puddleMask = 1.0 - smoothstep(0.62, 0.96, radialDist + edgeMod);
        if (puddleMask <= 0.01) discard;

        // 2. Dual-layer scrolling capillary wind waves + analytical raindrop ripples
        vec2 wUv1 = vWorldPos.xz * 0.32 + vec2(uTime * 0.025, uTime * 0.018);
        vec2 wUv2 = vWorldPos.xz * 0.48 - vec2(uTime * 0.021, -uTime * 0.028);
        vec3 n1 = texture2D(tNormalMap, wUv1).rgb * 2.0 - 1.0;
        vec3 n2 = texture2D(tNormalMap, wUv2).rgb * 2.0 - 1.0;
        vec2 waveGrad = (n1.xy + n2.xy) * 0.028;

        // Add 4tiled procedural raindrop impact wave trains across every 2.5m x 2.5m cell
        vec2 cell = floor(vWorldPos.xz / 2.4);
        vec2 localPos = fract(vWorldPos.xz / 2.4) * 2.4;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          float seed = fract(sin(dot(cell + vec2(fi * 13.7, fi * 7.3), vec2(12.9898, 78.233))) * 43758.5453);
          vec2 dropCenter = vec2(0.45 + fract(seed * 3.7) * 1.5, 0.45 + fract(seed * 9.1) * 1.5);
          float phase = fract(uTime * (0.65 + 0.25 * seed) + seed);
          waveGrad += rainRippleGrad(localPos, dropCenter, phase) * 0.055;
        }

        vec3 N = normalize(vec3(waveGrad.x, 1.0, waveGrad.y));
        vec3 V = normalize(uCameraPos - vWorldPos);
        float cosTheta = max(dot(N, V), 0.0);

        // 3. Schlick Fresnel Law for water film (R0 = 0.04, strong grazing mirror reflection)
        float fresnel = 0.12 + 0.88 * pow(1.0 - cosTheta, 4.2);

        // 4. Sample real-time planar mirror reflection with wave normal distortion
        vec2 projUv = vMirrorCoord.xy / max(0.001, vMirrorCoord.w);
        vec2 reflUv = clamp(projUv + waveGrad * 0.42, 0.002, 0.998);
        vec3 reflCol = texture2D(tReflection, reflUv).rgb;

        // 5. Anisotropic Wet Specular Streaks from Fire Barrels & High-Mast Sodium Floodlights (Matching Concept Art!)
        vec3 anisoStreak = vec3(0.0);
        vec3 lightSources[5];
        lightSources[0] = vec3(-3.2, 1.5, 25.5);
        lightSources[1] = vec3(-4.8, 1.5, 9.5);
        lightSources[2] = vec3(4.5, 1.5, -1.5);
        lightSources[3] = vec3(-12.0, 11.0, 20.0);
        lightSources[4] = vec3(11.5, 11.0, 4.0);
        for (int k = 0; k < 5; k++) {
          vec3 lPos = lightSources[k];
          vec3 toL = lPos - vWorldPos;
          float distL = length(toL);
          vec3 L = toL / max(0.1, distL);
          // Stretch reflection vector longitudinally along camera view direction for wet asphalt anisotropic sheen
          vec3 H = normalize(L + V + vec3(waveGrad.x * 2.4, 0.0, waveGrad.y * 0.7));
          float spec = pow(max(dot(N, H), 0.0), 42.0) / (1.0 + distL * 0.045);
          vec3 lCol = (k < 3) ? vec3(1.0, 0.42, 0.08) : vec3(1.0, 0.72, 0.32);
          anisoStreak += lCol * spec * 1.45;
        }

        // Enhance warm sodium/fire highlights reflected in the puddle
        vec3 deepWaterTint = vec3(0.025, 0.038, 0.055);
        vec3 finalCol = mix(deepWaterTint, reflCol * 1.18, fresnel) + anisoStreak * (0.45 + 0.55 * fresnel);

        gl_FragColor = vec4(finalCol, puddleMask * (0.60 + 0.38 * fresnel));
      }
    `,
  });
}

function updateGroundPlanarReflection() {
  if (!puddleShaderMat || puddleMeshes.length === 0) return;
  const mirrorPos = new THREE.Vector3(0, 0.014, 0);
  const normal = new THREE.Vector3(0, 1, 0);
  const camWorldPos = new THREE.Vector3();
  camera.getWorldPosition(camWorldPos);
  if (camWorldPos.y <= 0.02) return;

  puddleShaderMat.uniforms.uCameraPos.value.copy(camWorldPos);

  const view = mirrorPos.clone().sub(camWorldPos).reflect(normal).negate().add(mirrorPos);
  const rotMat = new THREE.Matrix4().extractRotation(camera.matrixWorld);
  const lookAtPos = new THREE.Vector3(0, 0, -1).applyMatrix4(rotMat).add(camWorldPos);
  const target = mirrorPos.clone().sub(lookAtPos).reflect(normal).negate().add(mirrorPos);

  groundMirrorCamera.position.copy(view);
  groundMirrorCamera.up.set(0, 1, 0).applyMatrix4(rotMat).reflect(normal);
  groundMirrorCamera.lookAt(target);
  groundMirrorCamera.far = camera.far;
  groundMirrorCamera.updateMatrixWorld();
  groundMirrorCamera.projectionMatrix.copy(camera.projectionMatrix);

  groundTexMatrix.set(
    0.5, 0.0, 0.0, 0.5,
    0.0, 0.5, 0.0, 0.5,
    0.0, 0.0, 0.5, 0.5,
    0.0, 0.0, 0.0, 1.0
  );
  groundTexMatrix.multiply(groundMirrorCamera.projectionMatrix);
  groundTexMatrix.multiply(groundMirrorCamera.matrixWorldInverse);

  // Oblique near-plane clipping at y = 0.014 so underwater geometry never leaks into reflections
  const mirrorPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, mirrorPos);
  mirrorPlane.applyMatrix4(groundMirrorCamera.matrixWorldInverse);
  const clipPlane = new THREE.Vector4(mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant);
  const proj = groundMirrorCamera.projectionMatrix;
  const q = new THREE.Vector4(
    (Math.sign(clipPlane.x) + proj.elements[8]) / proj.elements[0],
    (Math.sign(clipPlane.y) + proj.elements[9]) / proj.elements[5],
    -1.0,
    (1.0 + proj.elements[10]) / proj.elements[14]
  );
  clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
  proj.elements[2] = clipPlane.x;
  proj.elements[6] = clipPlane.y;
  proj.elements[10] = clipPlane.z + 1.0;
  proj.elements[14] = clipPlane.w;

  // Hide puddles, sea & animated characters during reflection render pass so ground reflection stays < 1.5ms!
  const prevFpVis = fpRig.visible;
  fpRig.visible = false;
  for (const pm of puddleMeshes) pm.visible = false;
  if (harborSeaWater) harborSeaWater.visible = false;
  const prevTpsVis = playerTpsRoot ? playerTpsRoot.visible : false;
  if (playerTpsRoot) playerTpsRoot.visible = false;
  for (const e of enemies) e.root.visible = false;

  const prevRT = renderer.getRenderTarget();
  const prevShadowAuto = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(groundReflectionRT);
  renderer.clear();
  renderer.render(scene, groundMirrorCamera);
  renderer.setRenderTarget(prevRT);
  renderer.shadowMap.autoUpdate = prevShadowAuto;

  fpRig.visible = prevFpVis;
  for (const pm of puddleMeshes) pm.visible = true;
  if (harborSeaWater) harborSeaWater.visible = true;
  if (playerTpsRoot) playerTpsRoot.visible = prevTpsVis;
  for (const e of enemies) e.root.visible = true;
}

buildAtmosphereAndLights();
setupFireBarrels();
setupHarborWaterAndPuddles();

// ---------------------------------------------------------------------------
// First-Person Viewmodel Rig (CC0 65-Bone Skinned Arms + Weapons from weapons_pack.glb)
// ---------------------------------------------------------------------------
const fpRig = new THREE.Group();
fpRig.position.set(0.22, -0.24, -0.38);
camera.add(fpRig);

const fpArmsHolder = new THREE.Group();
fpRig.add(fpArmsHolder);

const weaponMount = new THREE.Group();
fpRig.add(weaponMount);

const muzzleFlashMesh = new THREE.Mesh(
  new THREE.ConeGeometry(0.075, 0.24, 8),
  new THREE.MeshBasicMaterial({ color: 0xffb830, transparent: true, opacity: 0, blending: THREE.AdditiveBlending })
);
muzzleFlashMesh.rotation.x = -Math.PI / 2;
muzzleFlashMesh.position.set(0, 0.03, -0.64);
weaponMount.add(muzzleFlashMesh);

const muzzleLight = new THREE.PointLight(0xff9928, 0, 14, 1.5);
muzzleLight.position.set(0, 0.05, -0.68);
muzzleLight.visible = false;
weaponMount.add(muzzleLight);

// Green Tactical Laser Sight Beam & [T] Weapon-Mounted Tactical Spotlight
const smgLaserBeamGeo = new THREE.CylinderGeometry(0.0018, 0.0028, 16.0, 6);
smgLaserBeamGeo.rotateX(Math.PI / 2);
smgLaserBeamGeo.translate(0, 0, -8.0);
const smgLaserBeam = new THREE.Mesh(
  smgLaserBeamGeo,
  new THREE.MeshBasicMaterial({
    color: 0x33ff66,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
smgLaserBeam.position.set(0.024, 0.032, -0.24);
smgLaserBeam.visible = true;
weaponMount.add(smgLaserBeam);

const tacticalFlashlight = new THREE.SpotLight(0xdff2ff, 0, 42, 0.40, 0.55, 1.35);
tacticalFlashlight.position.set(0.02, 0.02, -0.35);
tacticalFlashlight.target.position.set(0.0, 0.0, -14.0);
tacticalFlashlight.visible = false;
weaponMount.add(tacticalFlashlight.target);

const weaponModels: Record<string, THREE.Object3D> = {};
let activeWeaponIdx = 0;

// Player Third-Person (TPS) Full-Body CC0 65-Bone Actor (Toggled via [P] key!)
let playerTpsRoot: THREE.Group | null = null;
let playerTpsMixer: THREE.AnimationMixer | null = null;
const playerTpsActions: Record<string, THREE.AnimationAction> = {};
let playerTpsActiveClip = '';
const playerTpsWeapons: Record<string, THREE.Object3D> = {};

// Loadout 3D Showcase Turntable Group + Dedicated Studio Backdrop, Tactical Hologram Ring & Studio Lights
const loadoutShowcaseGroup = new THREE.Group();
loadoutShowcaseGroup.visible = false;
const loadoutWeaponHolder = new THREE.Group();
const loadoutBackdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(3.8, 2.4),
  new THREE.MeshBasicMaterial({ color: 0x060b13, transparent: true, opacity: 0.94, depthWrite: false })
);
loadoutBackdrop.position.set(-0.24, 0.02, -0.42);
const loadoutPedestalRing = new THREE.Mesh(
  new THREE.RingGeometry(0.32, 0.35, 48),
  new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
loadoutPedestalRing.rotation.x = Math.PI * 0.42;
loadoutPedestalRing.position.set(0.0, -0.18, 0.0);
const loadoutKeyLight = new THREE.DirectionalLight(0xfff6e5, 8.5);
loadoutKeyLight.position.set(1.2, 1.4, 2.2);
loadoutKeyLight.target = loadoutWeaponHolder;
const loadoutRimLight = new THREE.DirectionalLight(0xffaa33, 6.2);
loadoutRimLight.position.set(-1.5, 0.9, 0.6);
loadoutRimLight.target = loadoutWeaponHolder;
const loadoutFillLight = new THREE.DirectionalLight(0x78b4ff, 5.4);
loadoutFillLight.position.set(0.2, -1.2, 1.8);
loadoutFillLight.target = loadoutWeaponHolder;
const loadoutFrontSpot = new THREE.PointLight(0xffffff, 18, 4.5, 1.2);
loadoutFrontSpot.position.set(0.15, 0.22, 0.85);
loadoutKeyLight.visible = false;
loadoutRimLight.visible = false;
loadoutFillLight.visible = false;
loadoutFrontSpot.visible = false;
loadoutShowcaseGroup.add(
  loadoutBackdrop,
  loadoutPedestalRing,
  loadoutWeaponHolder,
  loadoutKeyLight,
  loadoutRimLight,
  loadoutFillLight,
  loadoutFrontSpot
);
// Only attach loadoutShowcaseGroup to camera when Loadout Modal is open so its 4 lights are not in the active scene graph during gameplay!

// ---------------------------------------------------------------------------
// World Collision Boxes & Interactive Entities
// ---------------------------------------------------------------------------
const colliders: THREE.Box3[] = [];
const explosiveBarrels: ExplosiveBarrel[] = [];
const activeExplosions: ActiveExplosion[] = [];
const activeRockets: ActiveRocket[] = [];
const activeShells: ActiveShell[] = [];
const activeTracers: ActiveTracer[] = [];
const activeSmokePuffs: ActiveSmokePuff[] = [];
const activeGrenades: ActiveGrenade[] = [];
const activeLootDrops: LootDrop[] = [];
const enemies: EnemyActor[] = [];

// Pre-allocated Pool of 28 Bullet Impact Scorch Decals (0 dynamic geometry allocation!)
const MAX_IMPACT_DECALS = 28;
const impactDecalPool: THREE.Mesh[] = [];
let nextDecalIdx = 0;
const decalGeo = new THREE.CircleGeometry(0.058, 10);
const decalMat = new THREE.MeshBasicMaterial({
  color: 0x08090c,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
});
for (let i = 0; i < MAX_IMPACT_DECALS; i++) {
  const dm = new THREE.Mesh(decalGeo, decalMat);
  dm.visible = false;
  scene.add(dm);
  impactDecalPool.push(dm);
}

let soldierTemplateGltf: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;

function registerStaticColliders() {
  // Container stacks & warehouse walls & barriers for player AABB collision
  const boxes: [number, number, number, number, number, number][] = [
    [-1.8, 2.6, 14, 2.5, 5.2, 6.2],
    [0.8, 2.6, 14, 2.5, 5.2, 6.2],
    [3.4, 1.3, 14, 2.5, 2.6, 6.2],
    [-1.8, 2.6, 4, 2.5, 5.2, 6.2],
    [0.8, 1.3, 4, 2.5, 2.6, 6.2],
    [-1.8, 2.6, -6, 2.5, 5.2, 6.2],
    [1.2, 2.6, -6, 2.5, 5.2, 6.2],
    [7.5, 2.6, 11, 2.5, 5.2, 6.2],
    [7.5, 2.6, 2, 2.5, 5.2, 6.2],
    [7.5, 2.6, -8, 2.5, 5.2, 6.2],
    [-4.0, 2.6, -26, 6.2, 5.2, 2.5],
    [4.5, 1.3, -26, 6.2, 2.6, 2.5],
    [14.5, 1.4, 16.5, 3.5, 2.8, 3.5], // Guard Post
    [11.8, 1.1, 10.5, 2.4, 2.2, 4.7], // Tactical Humvee 1
    [18.5, 1.1, 12.2, 4.7, 2.2, 2.4], // Tactical Humvee 2
    [25.8, 4.2, -8, 0.6, 8.4, 30],    // Warehouse East Wall
    [19.0, 4.2, -22.8, 14.0, 8.4, 0.6], // Warehouse North Wall
  ];
  for (const [cx, cy, cz, sx, sy, sz] of boxes) {
    colliders.push(
      new THREE.Box3(
        new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
        new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2)
      )
    );
  }
}
registerStaticColliders();

function spawnExplosiveBarrels() {
  const coords: [number, number][] = [
    [-6.8, 12.0], [-6.1, 11.4], [2.2, 6.5], [-4.5, -11.0], [17.5, -6.5], [17.5, -15.0],
  ];
  const geo = new THREE.CylinderGeometry(0.31, 0.31, 0.96, 16);
  const ribGeo = new THREE.CylinderGeometry(0.322, 0.322, 0.045, 16);
  const bandGeo = new THREE.CylinderGeometry(0.316, 0.316, 0.14, 16);
  const bungGeo = new THREE.CylinderGeometry(0.038, 0.042, 0.035, 10);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7e1812,
    roughness: 0.64,
    metalness: 0.52,
    normalMap: sharedWaterNormals,
    normalScale: new THREE.Vector2(0.18, 0.18),
  });
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x16191d, roughness: 0.68, metalness: 0.78 });
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x9e6c14,
    roughness: 0.72,
    metalness: 0.25,
    normalMap: sharedWaterNormals,
    normalScale: new THREE.Vector2(0.12, 0.12),
  });
  const wreckMat = new THREE.MeshStandardMaterial({ color: 0x181615, roughness: 0.88, metalness: 0.35 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5511 });
  const scorchMat = new THREE.MeshBasicMaterial({
    color: 0x070708,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });

  coords.forEach(([x, z], i) => {
    // Visible, Detailed Destructible Explosive Barrel (vanishes cleanly upon detonation!)
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(x, 0.48, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const ribTop = new THREE.Mesh(ribGeo, ribMat);
    ribTop.position.y = 0.22;
    const ribBot = new THREE.Mesh(ribGeo, ribMat);
    ribBot.position.y = -0.22;
    const hazBand = new THREE.Mesh(bandGeo, bandMat);
    const bungCap = new THREE.Mesh(bungGeo, ribMat);
    bungCap.position.set(0.14, 0.49, 0.08);
    mesh.add(ribTop, ribBot, hazBand, bungCap);
    scene.add(mesh);

    // Pre-built Crumpled & Charred Barrel Wreck + Ground Scorch Crater + Persistent Wreck Flame
    const wreckGroup = new THREE.Group();
    wreckGroup.position.set(x, 0.0, z);
    wreckGroup.visible = false;

    const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.6, 20), scorchMat);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.018;
    wreckGroup.add(scorch);

    const crumpledShell = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.68, 10), wreckMat);
    crumpledShell.position.set(0.12, 0.24, -0.08);
    crumpledShell.rotation.set(1.15, i * 0.8, 0.45);
    crumpledShell.scale.set(1.15, 0.85, 0.72);
    wreckGroup.add(crumpledShell);

    for (let k = 0; k < 5; k++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.32), wreckMat);
      const ang = (k / 5) * Math.PI * 2 + i;
      shard.position.set(Math.cos(ang) * 0.85, 0.04, Math.sin(ang) * 0.85);
      shard.rotation.set(0.2, ang, 0.35);
      wreckGroup.add(shard);
    }

    const emberCore = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), emberMat);
    emberCore.position.set(0.08, 0.14, -0.05);
    emberCore.scale.set(1.5, 0.55, 1.5);
    wreckGroup.add(emberCore);

    if (fireShaderMats.length > 0) {
      const residualFlame = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.85, 4, 6), fireShaderMats[i % fireShaderMats.length]);
      residualFlame.position.set(0.08, 0.48, -0.05);
      const residualFlame2 = residualFlame.clone();
      residualFlame2.rotation.y = Math.PI / 2;
      wreckGroup.add(residualFlame, residualFlame2);
    }

    scene.add(wreckGroup);

    explosiveBarrels.push({
      id: `barrel_${i}`,
      position: mesh.position.clone(),
      mesh,
      wreckGroup,
      hp: 40,
      exploded: false,
    });
  });
}
spawnExplosiveBarrels();

// Interactive Suspended Crane Cargo Container Drop Hazard at (-6.5, 8.8, -14.0) under Gantry Crane!
let suspendedCargo: SuspendedCargoDrop | null = null;
function spawnSuspendedCraneContainer() {
  const group = new THREE.Group();
  group.position.set(-6.5, 8.8, -14.0);

  const contMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.44, 2.6, 6.1),
    new THREE.MeshStandardMaterial({
      color: 0x82221a,
      roughness: 0.55,
      metalness: 0.48,
      normalMap: sharedWaterNormals,
      normalScale: new THREE.Vector2(0.15, 0.15),
    })
  );
  contMesh.position.y = 1.3;
  contMesh.castShadow = true;
  contMesh.receiveShadow = true;
  group.add(contMesh);

  // Glowing Orange Explosive Release Shackle at Top of Container (y = 2.85 local)
  const shackleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.42, 12),
    new THREE.MeshBasicMaterial({ color: 0xff6611 })
  );
  shackleMesh.position.y = 2.82;
  group.add(shackleMesh);

  const cableGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-6.5, 21.8, -14.0),
    new THREE.Vector3(-6.5, 11.6, -14.0),
  ]);
  const cableLine = new THREE.Line(
    cableGeo,
    new THREE.LineBasicMaterial({ color: 0x475569 })
  );
  scene.add(cableLine);
  scene.add(group);

  suspendedCargo = {
    group,
    shackleMesh,
    cableLine,
    state: 'SUSPENDED',
    velY: 0,
    colliderAdded: false,
  };
}
spawnSuspendedCraneContainer();

function releaseSuspendedCargoContainer() {
  if (!suspendedCargo || suspendedCargo.state !== 'SUSPENDED') return;
  suspendedCargo.state = 'FALLING';
  suspendedCargo.velY = -2.5;
  suspendedCargo.shackleMesh.visible = false;
  suspendedCargo.cableLine.visible = false;
  const shackleWorld = suspendedCargo.group.position.clone().add(new THREE.Vector3(0, 2.8, 0));
  audioSys.play3D('assets/audio/impact_metal.wav', shackleWorld, player.pos, 8, 60, 1.0);
  showKillBanner('CRANE CARGO RELEASED!');
}

// ---------------------------------------------------------------------------
// Load GLB Assets (port_environment.glb, weapons_pack.glb, soldier_tactical_animated.glb)
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();

const screensMgr = new GameScreensManager();
const squadMgr = new SquadManager();
const gunsmithVisualizer = new WeaponsAttachmentVisualizer();
const pipScope = new PictureInPictureScope();
const infiltrationDirector = new InfiltrationDirector(camera);
const evacuationDirector = new EvacuationDirector(camera);
let worldDetails: WorldDetailsManager | null = null;

const first5SecTracker = {
  active: true,
  startTime: 0,
  maxFrameTimeMs: 0,
  recordedFrames: 0,
};

async function loadGlbAsset(relPath: string) {
  const preloaded = (window as unknown as { __PRELOADED_GLB_B64__?: Record<string, string> }).__PRELOADED_GLB_B64__?.[relPath];
  if (preloaded) {
    const binStr = atob(preloaded);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return gltfLoader.parseAsync(bytes.buffer, '');
  }
  return Promise.race([
    gltfLoader.loadAsync(relPath),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout loading GLB asset: ${relPath}`)), 15000)
    ),
  ]);
}

async function loadAllAssets() {
  // Step 1 [0%~25%]: Download GLBs & Map Data
  screensMgr.updatePreload({
    step: 1,
    totalSteps: 7,
    label: 'DOWNLOADING GLB ASSETS & MAP DATA',
    percent: 15,
    hint: '正在自 CDN / 快取下載夜間軍事港口、武器庫與士兵骨架模型...',
  });

  const [portGltf, wepGltf, soldierGltf] = await Promise.all([
    loadGlbAsset('assets/models/port_environment.glb'),
    loadGlbAsset('assets/models/weapons_pack.glb'),
    loadGlbAsset('assets/models/soldier_tactical_animated.glb'),
  ]);

  screensMgr.updatePreload({
    step: 2,
    totalSteps: 7,
    label: 'UPLOADING TEXTURES TO GPU VRAM (initTexture)',
    percent: 38,
    hint: '調用 renderer.initTexture 強制將所有漫反射、法線與粗糙度貼圖快取至顯示卡記憶體...',
  });

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const applyRepeatAndAnisotropy = (root: THREE.Object3D) => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          const std = mat as THREE.MeshStandardMaterial;
          if (!std) continue;
          for (const tex of [std.map, std.normalMap, std.roughnessMap, std.metalnessMap, std.aoMap]) {
            if (tex) {
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              tex.anisotropy = maxAniso;
              renderer.initTexture(tex);
              tex.needsUpdate = true;
            }
          }
        }
      }
    });
  };
  applyRepeatAndAnisotropy(portGltf.scene);
  applyRepeatAndAnisotropy(wepGltf.scene);
  applyRepeatAndAnisotropy(soldierGltf.scene);

  // 1. Add Night Port Environment & Upgrade Sea + Wet Puddles to Real-Time Planar Reflection Shaders
  puddleMeshes.length = 0;
  portGltf.scene.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.name === 'MI_Water_Puddle' && puddleShaderMat) {
        m.castShadow = false;
        m.material = puddleShaderMat;
        puddleMeshes.push(m);
      } else if (mat && mat.name === 'MI_Harbor_Sea') {
        m.visible = false;
      }
    }
  });
  scene.add(portGltf.scene);

  // 2. Extract Weapons for First-Person Viewmodel & Loadout Inspection
  for (const w of WEAPONS) {
    const found = wepGltf.scene.getObjectByName(w.nodeName);
    if (found) {
      const clone = found.clone(true);
      clone.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });
      weaponModels[w.id] = clone;
      weaponMount.add(clone);
    }
  }

  // Step 3 [40%~60%]: Pre-compile all shaders and render pipeline
  screensMgr.updatePreload({
    step: 3,
    totalSteps: 7,
    label: 'COMPILING SHADERS & GRAPHICS PIPELINE',
    percent: 55,
    hint: '執行 renderer.compile 預先編譯夜視儀、水窪反射、爆破火焰與武器頂點著色器...',
  });
  renderer.compile(scene, camera);

  // Step 4 [60%~75%]: Warm up skeletal animation rigs
  screensMgr.updatePreload({
    step: 4,
    totalSteps: 7,
    label: 'WARMING UP SKELETAL RIGS & TWO-BONE IK',
    percent: 72,
    hint: '預熱 CC0 65-Bone 士兵骨架、槍身兩骨式 IK 與換彈動畫矩陣...',
  });
  soldierTemplateGltf = { scene: soldierGltf.scene, animations: soldierGltf.animations };
  setupPlayerCc0ArmsAndThirdPerson();
  equipWeapon(0);
  spawnEnemySquad();
  setupTacticalPropsAndMarkings();

  // Initialize Tactical Stealth Helicopter
  if (!stealthHeli) {
    stealthHeli = createStealthHelicopter();
    scene.add(stealthHeli.group);
  }

  // Initialize Allied Squad (2 Members)
  squadMgr.initSquadMembers(soldierTemplateGltf, scene, player.pos);

  // Initialize Dynamic World Details (Rain & Breakable Lamps)
  worldDetails = new WorldDetailsManager(scene, rainLines, scene.fog as THREE.FogExp2);

  // Step 5 [75%~85%]: Warm up spatial audio system
  screensMgr.updatePreload({
    step: 5,
    totalSteps: 7,
    label: 'PRE-SYNTHESIZING ZERO-VOLUME AUDIO BUFFERS',
    percent: 85,
    hint: '預先載入 Web Audio 緩衝區並在零音量下試運行，避免首次槍聲解碼卡頓...',
  });
  await audioSys.unlockAndPreload();

  // Step 6 [85%~98%]: Multi-angle offscreen warmup renders
  screensMgr.updatePreload({
    step: 6,
    totalSteps: 7,
    label: 'WARMUP OFF-SCREEN MULTI-CAMERA RENDERS (6 PASSES)',
    percent: 96,
    hint: '沿港口開場鏡頭路徑預先繪製 6 個關鍵幀，促使 GPU 完成所有管線狀態快取 (PSO)...',
  });
  for (let camIdx = 0; camIdx < 6; camIdx++) {
    const angleRad = (camIdx / 6) * Math.PI * 2;
    camera.position.set(Math.cos(angleRad) * 12, 4.5, Math.sin(angleRad) * 12);
    camera.lookAt(0, 1.2, 0);
    renderer.render(scene, camera);
  }
  // Reset camera to default player spawn
  camera.position.set(blueprint.spawn.position[0], 1.72, blueprint.spawn.position[2]);
  camera.fov = 60;
  camera.updateProjectionMatrix();

  // Step 7 [100%]: Ready!
  screensMgr.updatePreload({
    step: 7,
    totalSteps: 7,
    label: '5-SECOND PERF MONITOR ENGAGED (< 50ms)',
    percent: 100,
    hint: '預載與引擎暖機完成！作戰準備就緒。',
  });

  first5SecTracker.active = true;
  first5SecTracker.startTime = performance.now();
  first5SecTracker.maxFrameTimeMs = 0;
  first5SecTracker.recordedFrames = 0;

  setTimeout(() => {
    screensMgr.hidePreload();
    if (isAutomatedQa) {
      operationStarted = true;
      if (!captureMode && !initialCamParam) {
        launchInfiltrationCutscene();
      }
    } else {
      screensMgr.showPortal(
        () => {
          launchInfiltrationCutscene();
        },
        () => {
          toggleLoadoutModal(true);
        }
      );
    }
  }, 450);

  renderer.shadowMap.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Rigforge Analytic Two-Bone Arm IK & Horizontal Shoulder-Pocket Rifle Mount
// ---------------------------------------------------------------------------
let fpArmsRoot: THREE.Group | null = null;
let fpArmsMixer: THREE.AnimationMixer | null = null;
let playerTpsWeaponMount: THREE.Group | null = null;

const _ikA = new THREE.Vector3();
const _ikB = new THREE.Vector3();
const _ikC = new THREE.Vector3();
const _ikT = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikPole = new THREE.Vector3();
const _ikMid = new THREE.Vector3();
const _ikQ = new THREE.Quaternion();
const _ikParentW = new THREE.Quaternion();
const _ikWorldQ = new THREE.Quaternion();
const _ikHandW = new THREE.Quaternion();

function setBoneWorldQuaternion(bone: THREE.Object3D, worldQ: THREE.Quaternion) {
  if (!bone.parent) return;
  bone.parent.getWorldQuaternion(_ikParentW);
  bone.quaternion.copy(_ikParentW.invert().multiply(worldQ));
  bone.updateMatrixWorld(true);
}

// Ported directly from Rigforge `solveLeg` (`src/footLock.js`): analytic two-bone IK with elbow pole vector
function solveTwoBoneIk(
  upperArm: THREE.Object3D | undefined,
  lowerArm: THREE.Object3D | undefined,
  hand: THREE.Object3D | undefined,
  targetWorld: THREE.Vector3,
  poleWorldDir: THREE.Vector3
) {
  if (!upperArm || !lowerArm || !hand) return;
  upperArm.getWorldPosition(_ikA);
  lowerArm.getWorldPosition(_ikB);
  hand.getWorldPosition(_ikC);
  hand.getWorldQuaternion(_ikHandW);

  const l1 = _ikB.distanceTo(_ikA);
  const l2 = _ikC.distanceTo(_ikB);
  if (l1 < 1e-4 || l2 < 1e-4) return;

  _ikT.copy(targetWorld);
  let d = _ikT.distanceTo(_ikA);
  const maxReach = (l1 + l2) * 0.996;
  const minReach = Math.abs(l1 - l2) * 1.02 + 1e-4;
  d = Math.min(maxReach, Math.max(minReach, d));

  _ikDir.subVectors(_ikT, _ikA).normalize();
  _ikPole.copy(poleWorldDir);
  _ikPole.addScaledVector(_ikDir, -_ikPole.dot(_ikDir));
  if (_ikPole.lengthSq() < 1e-8) {
    _ikPole.set(0, -1, 0).addScaledVector(_ikDir, -_ikDir.y);
  }
  _ikPole.normalize();

  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  _ikMid
    .copy(_ikA)
    .addScaledVector(_ikDir, cosA * l1)
    .addScaledVector(_ikPole, Math.sqrt(Math.max(0, 1 - cosA * cosA)) * l1);

  upperArm.getWorldQuaternion(_ikWorldQ);
  _ikQ.setFromUnitVectors(_ikB.clone().sub(_ikA).normalize(), _ikMid.clone().sub(_ikA).normalize());
  setBoneWorldQuaternion(upperArm, _ikWorldQ.premultiply(_ikQ));

  lowerArm.getWorldPosition(_ikB);
  hand.getWorldPosition(_ikC);
  lowerArm.getWorldQuaternion(_ikWorldQ);
  const reachPt = _ikA.clone().addScaledVector(_ikDir, d);
  _ikQ.setFromUnitVectors(_ikC.clone().sub(_ikB).normalize(), reachPt.sub(_ikB).normalize());
  setBoneWorldQuaternion(lowerArm, _ikWorldQ.premultiply(_ikQ));
  setBoneWorldQuaternion(hand, _ikHandW);
}

// Lock both CC0 65-bone arms onto the horizontal shoulder-mounted rifle (Right hand -> Pistol Grip, Left hand -> Vertical Foregrip)
function poseCharacterTwoHandRifleIk(
  charRoot: THREE.Object3D,
  rifleHolder: THREE.Object3D | undefined,
  aimPitch = 0,
  recoilZ = 0,
  reloadPct = 0
) {
  const spine3 = charRoot.getObjectByName('spine_03');
  const upperR = charRoot.getObjectByName('upperarm_r');
  const lowerR = charRoot.getObjectByName('lowerarm_r');
  const handR = charRoot.getObjectByName('hand_r');
  const upperL = charRoot.getObjectByName('upperarm_l');
  const lowerL = charRoot.getObjectByName('lowerarm_l');
  const handL = charRoot.getObjectByName('hand_l');
  if (!spine3 || !upperR || !lowerR || !handR || !upperL || !lowerL || !handL) return;

  charRoot.updateMatrixWorld(true);

  // 1. Orient rifle horizontally in the right shoulder pocket (+Z is character forward in UAL1)
  let gripWorld: THREE.Vector3;
  let foregripWorld: THREE.Vector3;
  let magWellWorld: THREE.Vector3;

  if (rifleHolder) {
    rifleHolder.position.set(-0.11, 0.04, 0.16 - recoilZ * 0.65);
    rifleHolder.rotation.set(-aimPitch, 0, 0);
    rifleHolder.updateMatrixWorld(true);
    // Note: weaponModels face -Z in their own local frame, so inside rifleHolder we rotated weapon Clones by Math.PI around Y
    gripWorld = rifleHolder.localToWorld(new THREE.Vector3(0.0, -0.055, -0.02));
    foregripWorld = rifleHolder.localToWorld(new THREE.Vector3(0.01, -0.048, 0.25));
    magWellWorld = rifleHolder.localToWorld(new THREE.Vector3(0.0, -0.11, 0.07));
  } else {
    // Built-in enemy rifle ('Soldier_AR7_Rifle_Rigid' attached to spine_03)
    const builtIn = charRoot.getObjectByName('Soldier_AR7_Rifle_Rigid');
    if (builtIn) {
      builtIn.rotation.set(-aimPitch, 0, 0);
      builtIn.updateMatrixWorld(true);
    }
    gripWorld = spine3.localToWorld(new THREE.Vector3(-0.10, -0.042, 0.13));
    foregripWorld = spine3.localToWorld(new THREE.Vector3(-0.10, -0.038, 0.36));
    magWellWorld = spine3.localToWorld(new THREE.Vector3(-0.10, -0.08, 0.25));
  }

  // Compute character world basis for natural elbow pole vectors (elbows down and slightly outward)
  const charQuat = new THREE.Quaternion();
  charRoot.getWorldQuaternion(charQuat);
  const worldRight = new THREE.Vector3(-1, 0, 0).applyQuaternion(charQuat); // -X is right side on UAL1
  const worldUp = new THREE.Vector3(0, 1, 0);
  const worldFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(charQuat);

  const poleR = worldRight.clone().multiplyScalar(0.65).addScaledVector(worldUp, -0.85).addScaledVector(worldFwd, -0.2).normalize();
  const poleL = worldRight.clone().multiplyScalar(-0.55).addScaledVector(worldUp, -0.90).addScaledVector(worldFwd, -0.15).normalize();

  // If reloading, animate left hand moving from foregrip -> magazine well -> foregrip
  const leftTarget = foregripWorld.clone();
  if (reloadPct > 0.01) {
    const magBlend = Math.sin(reloadPct * Math.PI);
    leftTarget.lerp(magWellWorld, magBlend);
  }

  solveTwoBoneIk(upperR, lowerR, handR, gripWorld, poleR);
  solveTwoBoneIk(upperL, lowerL, handL, leftTarget, poleL);

  // Align hands cleanly with the rifle barrel/grip so wrists never twist unnaturally
  const handGripQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-aimPitch, 0, 0, 'YXZ'));
  const worldHandR = charQuat.clone().multiply(handGripQuat).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, -1.25)));
  const worldHandL = charQuat.clone().multiply(handGripQuat).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, 1.35)));
  setBoneWorldQuaternion(handR, worldHandR);
  setBoneWorldQuaternion(handL, worldHandL);

  // Curl all 5 finger bone chains around the pistol grip (R) and foregrip (L) so characters never show open splayed fingers!
  for (const side of ['r', 'l'] as const) {
    const sign = side === 'r' ? 1 : -1;
    for (const fName of ['index', 'middle', 'ring', 'pinky']) {
      for (let j = 1; j <= 3; j++) {
        const fBone = charRoot.getObjectByName(`${fName}_0${j}_${side}`);
        if (fBone) {
          fBone.rotation.set(0.0, 0.0, sign * -1.05);
        }
      }
    }
    const thumb2 = charRoot.getObjectByName(`thumb_02_${side}`);
    const thumb3 = charRoot.getObjectByName(`thumb_03_${side}`);
    if (thumb2) thumb2.rotation.set(0.35, 0, sign * -0.65);
    if (thumb3) thumb3.rotation.set(0.25, 0, sign * -0.55);
  }
}

// Lock First-Person CC0 65-bone hands onto the active viewmodel weapon (Right hand -> Pistol Grip, Left hand -> Under-barrel Foregrip)
function updateFirstPersonCc0HandsIk() {
  if (!fpArmsRoot) return;
  const upperR = fpArmsRoot.getObjectByName('upperarm_r');
  const lowerR = fpArmsRoot.getObjectByName('lowerarm_r');
  const handR = fpArmsRoot.getObjectByName('hand_r');
  const upperL = fpArmsRoot.getObjectByName('upperarm_l');
  const lowerL = fpArmsRoot.getObjectByName('lowerarm_l');
  const handL = fpArmsRoot.getObjectByName('hand_l');
  if (!upperR || !lowerR || !handR || !upperL || !lowerL || !handL) return;

  weaponMount.updateMatrixWorld(true);
  // Weapon in weaponMount has Receiver at (0, 0.02, -0.03), Pistol Grip at (0, -0.06, 0.04), Foregrip at (0, -0.05, -0.25)
  const gripTargetWorld = weaponMount.localToWorld(new THREE.Vector3(0.015, -0.062, 0.038));
  const foregripTargetWorld = weaponMount.localToWorld(new THREE.Vector3(-0.016, -0.052, -0.235));
  const magTargetWorld = weaponMount.localToWorld(new THREE.Vector3(-0.01, -0.135, -0.065));

  const leftTarget = foregripTargetWorld.clone();
  if (player.reloading) {
    const w = WEAPONS[activeWeaponIdx];
    const pct = Math.min(1, player.reloadTimer / w.reloadTime);
    leftTarget.lerp(magTargetWorld, Math.sin(pct * Math.PI));
  }

  const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

  // Elbows stay below the sightline (`-camUp`) so right and left CC0 forearms & wristwatch enter cleanly in frame!
  const poleR = camRight.clone().multiplyScalar(0.55).addScaledVector(camUp, -0.95).addScaledVector(camFwd, -0.25).normalize();
  const poleL = camRight.clone().multiplyScalar(-0.48).addScaledVector(camUp, -0.62).addScaledVector(camFwd, 0.12).normalize();

  solveTwoBoneIk(upperR, lowerR, handR, gripTargetWorld, poleR);
  solveTwoBoneIk(upperL, lowerL, handL, leftTarget, poleL);
}

function playPlayerTpsClip(clipName: string, loop = true) {
  if (!playerTpsMixer || playerTpsActiveClip === clipName) return;
  const next = playerTpsActions[clipName] || playerTpsActions['Idle_Loop'];
  if (!next) return;
  const prev = playerTpsActions[playerTpsActiveClip];
  if (prev && prev !== next) {
    prev.fadeOut(0.16);
  }
  next.reset();
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  next.clampWhenFinished = !loop;
  next.fadeIn(0.16).play();
  playerTpsActiveClip = clipName;
}

function setupPlayerCc0ArmsAndThirdPerson() {
  if (!soldierTemplateGltf) return;

  // A) First-Person CC0 65-Bone Skinned Arms & 5-Finger Hands ('Soldier_CC0_Arms' + WristWatch)
  fpArmsHolder.clear();
  fpArmsRoot = SkeletonUtils.clone(soldierTemplateGltf.scene) as THREE.Group;
  const toRemoveFromFp: THREE.Object3D[] = [];
  fpArmsRoot.traverse((obj) => {
    // Explicitly zero out and hide head, helmet, balaclava and visor nodes so they can never occlude first-person camera!
    const isHeadOrHelmet =
      obj.name === 'Head' ||
      obj.name === 'neck_01' ||
      obj.name.includes('Helmet') ||
      obj.name.includes('Balaclava') ||
      obj.name.includes('Visor');
    if (isHeadOrHelmet) {
      obj.visible = false;
      obj.scale.set(0.0001, 0.0001, 0.0001);
    }

    if ((obj as THREE.Mesh).isMesh) {
      const isArmsOrWatch =
        obj.name.includes('Soldier_CC0_Arms') ||
        obj.name.includes('WristWatch') ||
        obj.name.includes('WatchScreen') ||
        obj.parent?.name === 'Soldier_CC0_Arms' ||
        obj.parent?.name?.includes('WristWatch') ||
        obj.parent?.name?.includes('WatchScreen');
      if (!isArmsOrWatch || isHeadOrHelmet) {
        obj.visible = false;
        toRemoveFromFp.push(obj);
      } else {
        obj.visible = true;
        obj.frustumCulled = false;
        obj.castShadow = false;
        obj.receiveShadow = true;
      }
    }
  });
  for (const rem of toRemoveFromFp) {
    rem.visible = false;
    rem.parent?.remove(rem);
  }

  // Use UAL1 'Sword_Idle' / 'Punch_Jab' fist finger curl + position shoulders just behind the camera
  fpArmsMixer = new THREE.AnimationMixer(fpArmsRoot);
  const fistClip =
    soldierTemplateGltf.animations.find((a) => a.name === 'Sword_Idle') ||
    soldierTemplateGltf.animations.find((a) => a.name === 'Pistol_Aim_Neutral');
  if (fistClip) {
    const act = fpArmsMixer.clipAction(fistClip);
    act.play();
    fpArmsMixer.update(0.1);
  }
  fpArmsRoot.rotation.y = Math.PI; // Face -Z along camera sightline
  fpArmsRoot.position.set(-0.08, -1.42, 0.22);
  fpArmsHolder.add(fpArmsRoot);
  weaponMount.add(fpArmsHolder);
  updateFirstPersonCc0HandsIk();

  // B) Third-Person Full-Body CC0 65-Bone Player Operator (Toggled via [P] key!)
  if (playerTpsRoot) scene.remove(playerTpsRoot);
  playerTpsRoot = SkeletonUtils.clone(soldierTemplateGltf.scene) as THREE.Group;
  playerTpsRoot.visible = false;
  playerTpsRoot.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
    }
  });

  // Hide built-in enemy rifle and mount swap-ready 3D weapons (AR-7, SR-9, RL-7) horizontally in the right shoulder pocket (`spine_03`)
  const builtInRifle = playerTpsRoot.getObjectByName('Soldier_AR7_Rifle_Rigid');
  if (builtInRifle) builtInRifle.visible = false;
  const tpsSpine3 = playerTpsRoot.getObjectByName('spine_03');
  playerTpsWeaponMount = new THREE.Group();
  playerTpsWeaponMount.name = 'Player_TPS_Shoulder_Weapon_Mount';
  playerTpsWeaponMount.position.set(-0.11, 0.04, 0.16);
  if (tpsSpine3) {
    tpsSpine3.add(playerTpsWeaponMount);
    for (const w of WEAPONS) {
      if (weaponModels[w.id]) {
        const wClone = weaponModels[w.id].clone(true);
        wClone.scale.setScalar(0.92);
        // weaponModels face -Z; rotate 180 deg around Y so barrel points +Z (forward in character space!)
        wClone.rotation.set(0, Math.PI, 0);
        wClone.position.set(0, 0, 0);
        wClone.visible = false;
        playerTpsWeaponMount.add(wClone);
        playerTpsWeapons[w.id] = wClone;
      }
    }
  }

  playerTpsMixer = new THREE.AnimationMixer(playerTpsRoot);
  for (const clip of soldierTemplateGltf.animations) {
    playerTpsActions[clip.name] = playerTpsMixer.clipAction(clip);
  }
  playPlayerTpsClip('Idle_Loop', true);
  playerTpsMixer.update(0.2);
  poseCharacterTwoHandRifleIk(playerTpsRoot, playerTpsWeaponMount, 0, 0, 0);
  scene.add(playerTpsRoot);
}

function playEnemyClip(enemy: EnemyActor, clipName: string, loop = true) {
  if (enemy.activeClip === clipName) return;
  const next = enemy.actions[clipName] || enemy.actions['Idle_Loop'];
  if (!next) return;
  const prev = enemy.actions[enemy.activeClip];
  if (prev && prev !== next) {
    prev.fadeOut(0.18);
  }
  next.reset();
  next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
  next.clampWhenFinished = !loop;
  next.fadeIn(0.18).play();
  enemy.activeClip = clipName;
}

function createStatusBadgeMat(symbol: string, bgCol: string, borderCol: string) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bgCol;
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = borderCol;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 32, 33);
  const tex = new THREE.CanvasTexture(c);
  return new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
}
const statusMatCombat = createStatusBadgeMat('!', 'rgba(185, 28, 28, 0.88)', '#f87171');
const statusMatCover = createStatusBadgeMat('🛡', 'rgba(3, 105, 161, 0.88)', '#38bdf8');
const statusMatPatrol = createStatusBadgeMat('?', 'rgba(161, 98, 7, 0.85)', '#facc15');
const enemyHpBgGeo = new THREE.PlaneGeometry(0.56, 0.065);
const enemyHpFillGeo = new THREE.PlaneGeometry(0.52, 0.042);
const enemyHpBgMat = new THREE.MeshBasicMaterial({ color: 0x090d14, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
const enemyHpFillMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });

function spawnEnemySquad() {
  if (!soldierTemplateGltf) return;
  // Clear existing
  for (const e of enemies) {
    if (e.laserLine) scene.remove(e.laserLine);
    scene.remove(e.root);
  }
  enemies.length = 0;

  const squadSpawns: {
    name: string;
    archetype: 'ASSAULT' | 'SNIPER' | 'BREACHER';
    hp: number;
    pos: [number, number, number];
    patrol: [number, number][];
    clip: string;
  }[] = [
    { name: '突撃兵 Alpha (West Dock)', archetype: 'ASSAULT', hp: 100, pos: [-6.5, 0.0, 2.0], patrol: [[-6.5, 2.0], [-6.5, -6.0]], clip: 'Walk_Loop' },
    { name: '突撃兵 Bravo (Crane Guard)', archetype: 'ASSAULT', hp: 100, pos: [-5.2, 0.0, -9.5], patrol: [[-5.2, -9.5], [-8.2, -16.0]], clip: 'Walk_Loop' },
    { name: '突撃兵 Charlie (Center Alley)', archetype: 'ASSAULT', hp: 100, pos: [3.2, 0.0, -2.0], patrol: [[3.2, -2.0], [3.2, -10.0]], clip: 'Idle_Loop' },
    { name: '狙撃兵 Delta (Catwalk Sniper 🎯)', archetype: 'SNIPER', hp: 90, pos: [6.2, 5.34, -5.0], patrol: [[6.2, -5.0], [6.2, -14.0]], clip: 'Idle_Loop' },
    { name: '突撃兵 Echo (Guard Post)', archetype: 'ASSAULT', hp: 100, pos: [14.5, 0.0, 6.0], patrol: [[14.5, 6.0], [14.5, -4.0]], clip: 'Walk_Loop' },
    { name: '重装兵 Foxtrot (Heavy Breacher 🛡)', archetype: 'BREACHER', hp: 145, pos: [16.5, 0.0, -6.5], patrol: [[16.5, -6.5], [20.5, -14.0]], clip: 'Crouch_Idle_Loop' },
    { name: '狙撃兵 Golf (Terminal Overwatch 🎯)', archetype: 'SNIPER', hp: 95, pos: [0.5, 0.0, -19.5], patrol: [[0.5, -19.5], [-6.5, -21.0]], clip: 'Walk_Loop' },
    { name: '重装隊長 Commander (Ship Deck 🛡)', archetype: 'BREACHER', hp: 160, pos: [-26.5, 6.6, -12.0], patrol: [[-26.5, -12.0], [-26.5, -4.0]], clip: 'Idle_Loop' },
  ];

  squadSpawns.forEach((sp, idx) => {
    const cloned = SkeletonUtils.clone(soldierTemplateGltf!.scene) as THREE.Group;
    cloned.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    if (sp.archetype === 'BREACHER') {
      cloned.scale.set(1.06, 1.03, 1.06); // Bulky heavy armor silhouette
    }
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });

    const mixer = new THREE.AnimationMixer(cloned);
    const actions: Record<string, THREE.AnimationAction> = {};
    for (const clip of soldierTemplateGltf!.animations) {
      actions[clip.name] = mixer.clipAction(clip);
    }

    const mf = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0 })
    );
    mf.position.set(-0.10, 1.38, 0.72);
    cloned.add(mf);

    // 3D Tactical Status Badge & Overhead HP Bar - all start in PATROL state!
    const statusSprite = new THREE.Sprite(statusMatPatrol);
    statusSprite.position.set(0, 2.16, 0);
    statusSprite.scale.set(0.28, 0.28, 1);
    cloned.add(statusSprite);

    const hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, 1.96, 0);
    hpBarGroup.visible = false; // Shown when enemy takes damage
    const hpBg = new THREE.Mesh(enemyHpBgGeo, enemyHpBgMat);
    const hpFillMesh = new THREE.Mesh(enemyHpFillGeo, enemyHpFillMat);
    hpFillMesh.position.z = 0.005;
    hpBarGroup.add(hpBg, hpFillMesh);
    cloned.add(hpBarGroup);

    // Visible Red Laser Sight Beam for Elite Sniper Lookouts (points forward along patrol, not at player at spawn!)
    let laserLine: THREE.Line | undefined;
    if (sp.archetype === 'SNIPER') {
      const lGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(sp.pos[0], sp.pos[1] + 1.42, sp.pos[2]),
        new THREE.Vector3(sp.pos[0], sp.pos[1] + 1.42, sp.pos[2] - 16.0),
      ]);
      const lMat = new THREE.LineBasicMaterial({
        color: 0xff2222,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      });
      laserLine = new THREE.Line(lGeo, lMat);
      scene.add(laserLine);
    }

    scene.add(cloned);

    const actor: EnemyActor = {
      id: `enemy_${idx + 1}`,
      name: sp.name,
      archetype: sp.archetype,
      root: cloned,
      mixer,
      actions,
      activeClip: '',
      hp: sp.hp,
      maxHp: sp.hp,
      state: 'PATROL',
      stateTimer: idx * 0.7,
      fireCooldown: 1.2 + idx * 0.3,
      patrolPoints: sp.patrol,
      patrolIdx: 0,
      baseY: sp.pos[1],
      muzzleFlash: mf,
      laserLine,
      statusSprite,
      hpFillMesh,
      hpBarGroup,
    };
    playEnemyClip(actor, sp.clip, true);
    // Advance mixer slightly so pose is immediately applied even in capture mode, then lock both hands onto the horizontal rifle via 2-Bone IK!
    mixer.update(0.25 + idx * 0.15);
    poseCharacterTwoHandRifleIk(cloned, undefined, sp.pos[1] > 2.5 ? -0.22 : 0.0, 0, 0);
    enemies.push(actor);
  });
  updateObjectiveHud();
}

// ---------------------------------------------------------------------------
// Player Controller, Weapons, Recoil, Reload & Combat Mechanics (Step 6)
// ---------------------------------------------------------------------------
const player = {
  pos: new THREE.Vector3(blueprint.spawn.position[0], 0.0, blueprint.spawn.position[2]),
  vel: new THREE.Vector3(),
  yaw: blueprint.spawn.yaw,
  pitch: 0.0,
  hp: 100,
  maxHp: 100,
  armor: 150,
  maxArmor: 150,
  crouching: false,
  sprinting: false,
  grounded: true,
  ads: false,
  reloading: false,
  reloadTimer: 0,
  fireTimer: 0,
  burstRemaining: 0,
  burstTimer: 0,
  leanTarget: 0, // -1 = Lean Left [Q], +1 = Lean Right [E], 0 = Center
  leanAmount: 0,
  meleeTimer: 0,
  grenades: 3,
  maxGrenades: 3,
  stims: 2,
  maxStims: 2,
  flashlightOn: false,
  nvgOn: false,
  autoFireOn: Boolean(window.matchMedia?.('(pointer: coarse)')?.matches),
  hudMinimal: false,
  drawerOpen: false,
  inspectTimer: 0,
  recoilOffsetZ: 0,
  recoilPitch: 0,
  cameraShake: 0,
  bobPhase: 0,
  stepTimer: 0,
  shotsFired: 0,
  shotsHit: 0,
  headshots: 0,
  kills: 0,
  multiKillCount: 0,
  multiKillTimer: 0,
  damageTaken: 0,
  gameMode: 'RAID' as 'RAID' | 'SURVIVAL' | 'SNIPER' | 'BLITZ',
  raidStage: 1 as 1 | 2 | 3 | 4 | 5,
  c4Planted: false,
  c4PlantProgress: 0,
  waveNumber: 1,
  blitzTimeRemaining: 90.0,
  lastEquippedWeaponIdx: 1,
  terminalHacked: false,
  terminalHackProgress: 0,
  startTime: performance.now(),
  fixedCameraKey: initialCamParam || null,
  thirdPerson: false,
};

const keys: Record<string, boolean> = {};
let mouseDownLeft = false;

function getGroundHeightAt(x: number, z: number): number {
  // Overhead Catwalk & Cross-Bridge + Staircases
  if (x >= 5.0 && x <= 7.4 && z >= -18.0 && z <= 14.0) return 5.34;
  if (x >= -7.5 && x <= 6.5 && z >= 0.8 && z <= 3.2 && player.pos.y > 3.2) return 5.34;
  // South Staircase (z = 21.5 -> 14.0, x = 5.1..7.3)
  if (x >= 5.0 && x <= 7.4 && z > 14.0 && z <= 21.8) {
    const t = Math.max(0, Math.min(1, (21.5 - z) / 7.5));
    return t * 5.34;
  }
  // North Staircase (z = -25.5 -> -18.0, x = 5.1..7.3)
  if (x >= 5.0 && x <= 7.4 && z >= -25.8 && z < -18.0) {
    const t = Math.max(0, Math.min(1, (z - -25.5) / 7.5));
    return t * 5.34;
  }
  // Cargo Ship Boarding Gangway & Main Deck
  if (x <= -23.0 && x >= -41.0 && z >= -36.0 && z <= 24.0) {
    return 6.6;
  }
  return 0.0;
}

function equipWeapon(idx: number) {
  if (idx < 0 || idx >= WEAPONS.length) return;
  if (idx !== activeWeaponIdx) {
    player.lastEquippedWeaponIdx = activeWeaponIdx;
  }
  activeWeaponIdx = idx;
  player.reloading = false;
  player.burstRemaining = 0;
  document.getElementById('reload-box')?.classList.add('hidden');
  WEAPONS.forEach((w, i) => {
    if (weaponModels[w.id]) weaponModels[w.id].visible = i === idx;
    if (playerTpsWeapons[w.id]) playerTpsWeapons[w.id].visible = i === idx;
    document.getElementById(`slot-${i + 1}`)?.classList.toggle('active', i === idx);
  });
  smgLaserBeam.visible = Boolean(WEAPONS[idx].hasGreenLaser);
  document.getElementById('reticle-shotgun-ring')?.classList.toggle('hidden', WEAPONS[idx].id !== 'sg12');
  if (player.ads) setAdsState(true);
  updateWeaponHud();
  updateLoadoutModal(idx);
}

function quickSwapWeapon() {
  const targetIdx =
    player.lastEquippedWeaponIdx !== activeWeaponIdx &&
    player.lastEquippedWeaponIdx >= 0 &&
    player.lastEquippedWeaponIdx < WEAPONS.length
      ? player.lastEquippedWeaponIdx
      : (activeWeaponIdx + 1) % 3;
  equipWeapon(targetIdx);
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.8);
}

function cycleFireMode() {
  const w = WEAPONS[activeWeaponIdx];
  if (!w.supportedModes || w.supportedModes.length <= 1) return;
  const curIdx = w.supportedModes.indexOf(w.fireMode as 'AUTO' | 'BURST' | 'SEMI');
  const nextMode = w.supportedModes[(curIdx + 1) % w.supportedModes.length];
  w.fireMode = nextMode;
  player.burstRemaining = 0;
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.85);
  updateWeaponHud();
}

function setThirdPersonMode(enabled?: boolean) {
  player.thirdPerson = enabled !== undefined ? enabled : !player.thirdPerson;
  const inModal = loadoutOpen || missionModalOpen;
  fpRig.visible = !player.thirdPerson && !inModal && !player.fixedCameraKey;
  if (playerTpsRoot) {
    playerTpsRoot.visible = (player.thirdPerson || Boolean(player.fixedCameraKey)) && !inModal;
  }
  document.getElementById('touch-btn-tps-quick')?.classList.toggle('active', player.thirdPerson);
  updateStatusHud();
}

function updateWeaponHud() {
  const w = WEAPONS[activeWeaponIdx];
  const titleEl = document.getElementById('weapon-title');
  const iconEl = document.getElementById('weapon-icon-svg');
  const magEl = document.getElementById('ammo-mag');
  const resEl = document.getElementById('ammo-reserve');
  const modeEl = document.getElementById('fire-mode-badge');
  const ticksEl = document.getElementById('ammo-ticks');
  const grenEl = document.getElementById('grenade-badge');
  const slotGCount = document.getElementById('slot-g-count');
  const stimEl = document.getElementById('stim-badge');
  const lightEl = document.getElementById('flashlight-badge');
  const nvgEl = document.getElementById('nvg-badge');
  if (titleEl) titleEl.textContent = w.name;
  if (iconEl) iconEl.textContent = w.silhouette;
  if (magEl) magEl.textContent = String(w.mag);
  if (resEl) resEl.textContent = String(w.reserve);
  if (modeEl) modeEl.textContent = w.fireMode;
  if (grenEl) grenEl.textContent = `💣 [G] x${player.grenades}`;
  if (slotGCount) slotGCount.textContent = `×${player.grenades}`;
  if (stimEl) stimEl.textContent = `💉 [X] x${player.stims}`;
  if (lightEl) {
    lightEl.textContent = `🔦 [T] ${player.flashlightOn ? 'ON' : 'OFF'}`;
    lightEl.classList.toggle('active', player.flashlightOn);
  }
  if (nvgEl) {
    nvgEl.textContent = `🥽 [N] ${player.nvgOn ? 'ON' : 'OFF'}`;
    nvgEl.classList.toggle('active', player.nvgOn);
  }
  document.getElementById('touch-btn-nvg-quick')?.classList.toggle('active', player.nvgOn);
  if (ticksEl) {
    const count = Math.min(20, Math.ceil((w.mag / w.magSize) * 20));
    ticksEl.textContent = '|'.repeat(count) + '·'.repeat(20 - count);
  }
}

function updateStatusHud() {
  const hpVal = document.getElementById('hp-val');
  const hpBar = document.getElementById('hp-bar');
  const arVal = document.getElementById('armor-val');
  const arBar = document.getElementById('armor-bar');
  const stanceEl = document.getElementById('stance-text');
  if (hpVal) hpVal.textContent = String(Math.max(0, Math.round(player.hp)));
  if (hpBar) hpBar.style.width = `${Math.max(0, (player.hp / player.maxHp) * 100)}%`;
  if (arVal) arVal.textContent = String(Math.max(0, Math.round(player.armor)));
  if (arBar) arBar.style.width = `${Math.max(0, (player.armor / player.maxArmor) * 100)}%`;
  document.getElementById('touch-btn-crouch')?.classList.toggle('active', player.crouching);
  if (stanceEl) {
    const viewPrefix = player.thirdPerson ? '[TPS] ' : '[FPS] ';
    const leanSuffix =
      player.leanTarget < -0.1
        ? ' [↖ 左探頭]'
        : player.leanTarget > 0.1
        ? ' [↗ 右探頭]'
        : '';
    const stanceLabel = player.crouching
      ? 'CROUCH // 戰術蹲姿'
      : player.sprinting
      ? 'SPRINT // 戰術衝刺'
      : 'STAND // 站立警戒';
    stanceEl.textContent = viewPrefix + stanceLabel + leanSuffix;
  }
}

const currentObjectiveTarget = new THREE.Vector3(-4.8, 1.35, 9.5);

function getActiveObjectiveTarget(): THREE.Vector3 {
  if (player.gameMode === 'RAID') {
    if (player.raidStage === 1) {
      const vg = enemies.find((e) => e.state !== 'DEAD');
      if (vg) {
        currentObjectiveTarget.set(vg.root.position.x, vg.root.position.y + 1.35, vg.root.position.z);
        return currentObjectiveTarget;
      }
    } else if (player.raidStage === 2 && !player.c4Planted) {
      currentObjectiveTarget.set(-4.8, 1.15, 9.5);
      return currentObjectiveTarget;
    }
    currentObjectiveTarget.set(-4.0, 1.35, -18.0);
    return currentObjectiveTarget;
  }
  if (player.gameMode === 'SNIPER') {
    const snTarget =
      enemies.find((e) => e.state !== 'DEAD' && (e.archetype === 'SNIPER' || e.archetype === 'BREACHER')) ||
      enemies.find((e) => e.state !== 'DEAD');
    if (snTarget) {
      currentObjectiveTarget.set(snTarget.root.position.x, snTarget.root.position.y + 1.45, snTarget.root.position.z);
      return currentObjectiveTarget;
    }
  }
  const nearest = enemies
    .filter((e) => e.state !== 'DEAD')
    .sort((a, b) => a.root.position.distanceTo(player.pos) - b.root.position.distanceTo(player.pos))[0];
  if (nearest) {
    currentObjectiveTarget.set(nearest.root.position.x, nearest.root.position.y + 1.35, nearest.root.position.z);
    return currentObjectiveTarget;
  }
  currentObjectiveTarget.set(-4.0, 1.35, -18.0);
  return currentObjectiveTarget;
}

function updateObjectiveHud() {
  const alive = enemies.filter((e) => e.state !== 'DEAD').length;
  const total = enemies.length || 8;
  const killed = total - alive;

  // Automatically advance Tactical Raid 3-Stage Chain!
  if (player.gameMode === 'RAID') {
    if (player.raidStage === 1 && killed >= 2) {
      player.raidStage = 2;
      showKillBanner('STAGE 2/3 — PLANT C4 ON FUEL BARRELS');
    }
    if (player.raidStage === 2 && player.c4Planted) {
      player.raidStage = 3;
    }
  }

  const stageEl = document.getElementById('objective-stage');
  const objText = document.getElementById('objective-text');
  const modeBtn = document.getElementById('btn-mode-cycle');
  const modeNames: Record<string, string> = {
    RAID: '戰術突襲',
    SURVIVAL: '波次生存',
    SNIPER: '高空狙擊',
    BLITZ: '極速計時',
  };
  if (modeBtn) {
    modeBtn.textContent = `模式: ${modeNames[player.gameMode] || '戰術突襲'} ▾`;
  }

  if (player.gameMode === 'RAID') {
    if (stageEl) stageEl.textContent = `${player.raidStage}/5 · OBJECTIVE`;
    if (objText) {
      if (player.raidStage === 1) {
        objText.textContent = `肅清西側碼頭前哨守軍 (${Math.min(2, killed)}/2) 推進防線`;
      } else if (player.raidStage === 2) {
        objText.textContent = '於油料桶區安裝 C4 爆破電荷 — 靠近油桶按 [E] 安裝';
      } else if (player.raidStage === 3) {
        objText.textContent =
          alive > 0 || !player.terminalHacked
            ? `奪還北側主控終端並肅清守軍 (${killed}/${total})`
            : '目標達成：港務主控終端已奪還！';
      } else if (player.raidStage === 4) {
        objText.textContent = '⚠️ 全域紅色警報：消滅巨型起重機重裝兵 [GOLIATH-01]！';
      } else {
        objText.textContent = '🚁 全員熱撤離：迅速撤退至西側碼頭停機坪 (LZ-DELTA) 登機！';
      }
    }
    const distEl = document.getElementById('objective-dist');
    if (distEl) {
      if (player.raidStage === 4 && bossActorRef && bossActorRef.state !== 'DEAD') {
        const d = Math.round(player.pos.distanceTo(bossActorRef.root.position));
        distEl.textContent = `(${d} m)`;
      } else if (player.raidStage === 5) {
        const d = Math.round(player.pos.distanceTo(new THREE.Vector3(-18, 0.2, 38)));
        distEl.textContent = `(${d} m)`;
      }
    }
  } else if (player.gameMode === 'SURVIVAL') {
    if (stageEl) stageEl.textContent = `WAVE ${player.waveNumber} · SURVIVAL`;
    if (objText) {
      objText.textContent = `抵禦港區增援敵軍攻勢 · 剩餘敵軍 (${alive} 名) · 擊殺掉落護甲補給`;
    }
  } else if (player.gameMode === 'SNIPER') {
    if (stageEl) stageEl.textContent = `OVERWATCH · SNIPER`;
    if (objText) {
      objText.textContent = `於高空走道使用 SR-9 8x 狙擊鏡精準獵殺目標 (${killed}/${total})`;
    }
  } else if (player.gameMode === 'BLITZ') {
    const secLeft = Math.max(0, Math.ceil(player.blitzTimeRemaining));
    if (stageEl) stageEl.textContent = `⏱️ ${secLeft}s · TIME BLITZ`;
    if (objText) {
      objText.textContent = `極速肅清守軍 (${killed}/${total}) · 爆頭擊殺 +6s / 油桶連爆 +5s`;
    }
  }
}

function setGameMode(mode: 'RAID' | 'SURVIVAL' | 'SNIPER' | 'BLITZ') {
  player.gameMode = mode;
  player.raidStage = 1;
  player.c4Planted = false;
  player.c4PlantProgress = 0;
  player.terminalHacked = false;
  player.terminalHackProgress = 0;
  player.waveNumber = 1;
  player.blitzTimeRemaining = 90.0;
  player.hp = 100;
  player.armor = 150;
  player.grenades = 3;
  player.stims = 2;

  spawnEnemySquad();

  if (mode === 'SNIPER') {
    // Teleport player onto Elevated Container Catwalk with SR-9 8x Sniper Rifle!
    player.pos.set(6.1, 5.34, 10.5);
    player.yaw = 0.12;
    player.pitch = -0.14;
    equipWeapon(3); // SR-9 Sniper
    showKillBanner('🎯 高空狙擊獵殺模式 — SR-9 8X');
  } else if (mode === 'SURVIVAL') {
    player.pos.set(-1.5, 0.0, 18.0);
    player.yaw = 0.0;
    player.pitch = 0.0;
    equipWeapon(2); // SG-12 Pump Shotgun
    showKillBanner('🌊 波次防衛生存戰 — WAVE 1');
  } else if (mode === 'BLITZ') {
    player.pos.set(-1.5, 0.0, 22.0);
    player.yaw = 0.0;
    player.pitch = 0.0;
    equipWeapon(1); // SMG-9 Tactical
    showKillBanner('⏱️ 90秒極速肅清計時賽 START!');
  } else {
    player.pos.set(blueprint.spawn.position[0], 0.0, blueprint.spawn.position[2]);
    player.yaw = blueprint.spawn.yaw;
    player.pitch = 0.0;
    equipWeapon(0); // AR-7 Carbine
    showKillBanner('⚔️ 戰術突襲 (3階段連鎖任務)');
  }

  document.querySelectorAll('.touch-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.mode === mode);
  });
  updateStatusHud();
  updateWeaponHud();
  updateObjectiveHud();
}

function showKillBanner(text: string) {
  const banner = document.getElementById('kill-banner');
  const txt = document.getElementById('kill-banner-text');
  if (banner && txt) {
    txt.textContent = text;
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 2200);
  }
}

function pushKillfeed(weaponName: string, victimName: string, headshot: boolean) {
  const feed = document.getElementById('killfeed');
  if (!feed) return;
  const item = document.createElement('div');
  item.className = 'killfeed-item';
  item.innerHTML = `<span class="kf-killer">YOU</span><span class="kf-weapon">[${weaponName}${headshot ? ' 🎯' : ''}]</span><span class="kf-victim">${victimName}</span>`;
  feed.prepend(item);
  const isMobilePortrait = window.innerWidth <= 768;
  const maxItems = isMobilePortrait ? 1 : 4;
  while (feed.children.length > maxItems) {
    feed.removeChild(feed.lastChild!);
  }
  setTimeout(() => {
    item.style.opacity = '0';
    setTimeout(() => item.remove(), 250);
  }, isMobilePortrait ? 2000 : 3500);
}

function triggerHitmarker() {
  const hm = document.getElementById('hitmarker');
  if (!hm) return;
  hm.classList.remove('hidden');
  setTimeout(() => hm.classList.add('hidden'), 140);
}

function startReload() {
  const w = WEAPONS[activeWeaponIdx];
  if (player.reloading || w.mag >= w.magSize || w.reserve <= 0) return;
  player.reloading = true;
  player.reloadTimer = 0;
  audioSys.play2D('assets/audio/reload.wav', 0.8);
  document.getElementById('reload-box')?.classList.remove('hidden');
}

function triggerExplosionAt(pos: THREE.Vector3, radius = 7.5, maxDamage = 165) {
  audioSys.play3D('assets/audio/explosion.wav', pos, player.pos, 10, 80, 1.0);

  // Apply distance-attenuated Camera Trauma Shake
  const distToPlayer = pos.distanceTo(camera.position);
  if (distToPlayer < 48) {
    player.cameraShake = Math.min(1.0, player.cameraShake + Math.max(0.18, 1.0 - distToPlayer / 48) * 0.85);
  }

  // Reveal permanent ground scorch decal & crumpled wreck if near an explosive barrel, and trigger chain-reaction detonation!
  for (const b of explosiveBarrels) {
    const dBarrel = b.position.distanceTo(pos);
    if (dBarrel < 2.2) {
      b.exploded = true;
      b.mesh.visible = false;
      b.wreckGroup.visible = true;
      if (!narrativeState.fuelDepot) {
        narrativeState.fuelDepot = true;
        tacticalRadioAudio.speakRadioLine('ROACH', 'Depot is up in smoke! Alarm sounding!');
        screensMgr.showInGameRadio('[ROACH]', '"Depot is up in smoke! Alarm sounding across the port!"', 4.0);
        setTimeout(() => {
          tacticalRadioAudio.speakRadioLine('COMMAND', 'Hostile armor reacting! Advance to the ship bridge terminal!');
          screensMgr.showInGameRadio('[COMMAND]', '"Hostile armor reacting! Advance to the ship bridge terminal!"', 4.5);
        }, 3500);
      }
    } else if (!b.exploded && dBarrel < radius * 0.92) {
      b.exploded = true;
      setTimeout(() => {
        b.mesh.visible = false;
        b.wreckGroup.visible = true;
        triggerExplosionAt(b.position.clone(), 8.0, 175);
      }, 150);
    }
  }

  const group = new THREE.Group();
  group.position.copy(pos);

  // White-Hot Inner Flash Core (renderOrder 12 so it blazes brightly over smoke)
  const innerCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.92, 2),
    new THREE.MeshBasicMaterial({
      color: 0xfff8e0,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  innerCore.position.y = 1.05;
  innerCore.renderOrder = 12;

  // Fiery Orange-Red Outer Fireball
  const core = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.42, 2),
    new THREE.MeshBasicMaterial({
      color: 0xff5a12,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  core.position.y = 1.25;
  core.renderOrder = 11;

  // Primary Billowing Dark Smoke Crown (rises above the fireball)
  const plume = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.95, 2),
    new THREE.MeshStandardMaterial({
      color: 0x161412,
      emissive: 0x441504,
      emissiveIntensity: 0.65,
      roughness: 0.95,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );
  plume.position.set(-0.35, 2.35, -0.25);
  plume.renderOrder = 9;

  // Secondary Rolling Flame & Ember Lobe
  const secondaryPlume = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1.12, 2),
    new THREE.MeshBasicMaterial({
      color: 0xff8822,
      transparent: true,
      opacity: 0.90,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  secondaryPlume.position.set(0.52, 1.55, 0.28);
  secondaryPlume.renderOrder = 11;

  // Expanding Supersonic Ground Shockwave Ring
  const shockwave = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 1.55, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffb844,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  shockwave.rotation.x = -Math.PI / 2;
  shockwave.position.y = 0.22;
  shockwave.renderOrder = 10;

  // High-Intensity Dynamic Blast PointLight (illuminates surrounding containers & puddles!)
  const blastLight = new THREE.PointLight(0xff7722, 110, 36, 1.3);
  blastLight.position.set(0, 2.4, 0);

  // 28 Ballistic Glowing Shrapnel Sparks & Flaming Debris Streaks
  const debris: ExplosionDebris[] = [];
  const sparkGeo = new THREE.BoxGeometry(0.16, 0.10, 0.36);
  for (let i = 0; i < 28; i++) {
    const isGlowing = i % 3 !== 0;
    const dMat = new THREE.MeshBasicMaterial({
      color: isGlowing ? 0xffcc44 : 0xff4411,
      transparent: true,
      opacity: 1.0,
      blending: isGlowing ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });
    const dMesh = new THREE.Mesh(sparkGeo, dMat);
    const theta = (i / 28) * Math.PI * 2 + (i % 3) * 0.2;
    const speed = 6.5 + (i % 7) * 2.1;
    const vy = 5.5 + (i % 5) * 2.4;
    dMesh.position.set(Math.cos(theta) * 0.55, 0.8 + (i % 4) * 0.3, Math.sin(theta) * 0.55);
    dMesh.lookAt(
      dMesh.position.x + Math.cos(theta) * speed,
      dMesh.position.y + vy,
      dMesh.position.z + Math.sin(theta) * speed
    );
    group.add(dMesh);
    debris.push({
      mesh: dMesh,
      vel: new THREE.Vector3(Math.cos(theta) * speed, vy, Math.sin(theta) * speed),
      rotSpeed: new THREE.Vector3(6 + i, 8 - i * 0.5, 5 + i * 0.3),
    });
  }

  group.add(innerCore, core, plume, secondaryPlume, shockwave, blastLight);
  scene.add(group);
  activeExplosions.push({
    group,
    core,
    innerCore,
    plume,
    secondaryPlume,
    shockwave,
    blastLight,
    debris,
    age: 0,
    duration: 1.55,
  });

  // Damage & knock back enemies within blast radius
  let blastKills = 0;
  for (const e of enemies) {
    if (e.state === 'DEAD') continue;
    const d = e.root.position.distanceTo(pos);
    if (d <= radius) {
      const pushDir = e.root.position.clone().sub(pos);
      pushDir.y = 0;
      if (pushDir.lengthSq() > 0.01) {
        pushDir.normalize().multiplyScalar((1 - d / radius) * 1.45);
        e.root.position.add(pushDir);
      }
      const dmg = maxDamage * (1 - d / (radius * 1.15));
      damageEnemy(e, dmg, false, 'RL-7 ロケット');
      if ((e.state as string) === 'DEAD') blastKills++;
    }
  }
  if (blastKills >= 3) {
    showKillBanner('TRIPLE KILL +100');
  } else if (blastKills === 2) {
    showKillBanner('DOUBLE KILL +150');
  }
  if (suspendedCargo && suspendedCargo.state === 'SUSPENDED') {
    const shackleWorld = new THREE.Vector3();
    suspendedCargo.shackleMesh.getWorldPosition(shackleWorld);
    if (shackleWorld.distanceTo(pos) <= radius + 4.5) {
      releaseSuspendedCargoContainer();
    }
  }
}

function damageEnemy(enemy: EnemyActor, amount: number, isHeadshot: boolean, weaponLabel: string) {
  if (enemy.state === 'DEAD') return;

  let finalAmount = amount;
  if (enemy.archetype === 'JUGGERNAUT') {
    const isExplosive = weaponLabel.includes('ロケット') || weaponLabel.includes('GRENADE') || weaponLabel.includes('BARREL') || weaponLabel.includes('C4');
    if (isExplosive) {
      enemy.isStaggered = true;
      enemy.staggerTimer = 3.5;
      if (enemy.shieldGroup) {
        enemy.shieldGroup.rotation.y = -1.45;
      }
      tacticalRadioAudio.playJuggernautStagger();
      showKillBanner('JUGGERNAUT STAGGERED // CORE EXPOSED!');
      screensMgr.showInGameRadio('[ROACH]', '"Shield guard broken! Pour fire into his core now!"', 3.5);
      tacticalRadioAudio.speakRadioLine('ROACH', 'Shield guard broken! Pour fire into his core now!');
    } else {
      const toPlayer = player.pos.clone().sub(enemy.root.position);
      toPlayer.y = 0;
      const enemyFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(enemy.root.quaternion);
      const dot = toPlayer.normalize().dot(enemyFwd);
      if (dot > 0.35) {
        if (!enemy.isStaggered) {
          finalAmount *= 0.2;
          tacticalRadioAudio.playHeavyShieldImpact();
          showKillBanner('SHIELD DEFLECTED (-80%)');
        } else {
          finalAmount *= 1.4;
          showKillBanner('CRITICAL CORE HIT +150');
        }
      }
    }
  }

  enemy.hp -= finalAmount;
  triggerHitmarker();

  if (enemy.archetype === 'JUGGERNAUT') {
    const bossHpText = document.getElementById('boss-hp-text');
    const bossHpFill = document.getElementById('boss-hp-fill');
    const bossShieldInd = document.getElementById('boss-shield-indicator');
    if (bossHpText) bossHpText.textContent = `${Math.max(0, Math.round(enemy.hp))} / 1200 HP`;
    if (bossHpFill) bossHpFill.style.width = `${Math.max(0, (enemy.hp / 1200) * 100)}%`;
    if (bossShieldInd) {
      bossShieldInd.textContent = enemy.isStaggered ? '⚠️ 核心暴露中: 破防 (易傷40%)' : '🛡️ 防彈重盾: 啟用中 (減傷80%)';
      bossShieldInd.style.color = enemy.isStaggered ? '#ef4444' : '#38bdf8';
    }
  }

  if (enemy.hpBarGroup && enemy.hpFillMesh) {
    enemy.hpBarGroup.visible = true;
    const pct = Math.max(0.02, enemy.hp / enemy.maxHp);
    enemy.hpFillMesh.scale.x = pct;
    enemy.hpFillMesh.position.x = -0.26 * (1 - pct);
  }

  // Spawn 3D ballistic blood mist & armor spark burst at impact point
  const hitPos = enemy.root.position.clone().add(new THREE.Vector3(0, isHeadshot ? 1.62 : 1.08, 0));
  const impactGeo = new THREE.SphereGeometry(isHeadshot ? 0.055 : 0.042, 6, 6);
  for (let i = 0; i < (isHeadshot ? 9 : 6); i++) {
    const isSpark = i % 2 === 0;
    const pMat = new THREE.MeshBasicMaterial({
      color: isSpark ? (isHeadshot ? 0xffdd55 : 0xffaa33) : 0xaa1118,
      transparent: true,
      opacity: 0.92,
      blending: isSpark ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });
    const pMesh = new THREE.Mesh(impactGeo, pMat);
    const ang = (i / 8) * Math.PI * 2;
    pMesh.position.copy(hitPos).add(new THREE.Vector3(Math.cos(ang) * 0.14, (i % 3) * 0.06, Math.sin(ang) * 0.14));
    scene.add(pMesh);
    activeSmokePuffs.push({ mesh: pMesh, age: 0, maxAge: 0.28 });
  }

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.state = 'DEAD';
    if (enemy.laserLine) enemy.laserLine.visible = false;
    if (enemy.statusSprite) enemy.statusSprite.visible = false;
    if (enemy.hpBarGroup) enemy.hpBarGroup.visible = false;
    playEnemyClip(enemy, 'Death01', false);
    player.kills++;

    if (enemy.archetype === 'JUGGERNAUT') {
      bossDefeated = true;
      bossActive = false;
      document.getElementById('boss-hud-card')?.classList.add('hidden');
      player.raidStage = 5;
      spawnGreenSmokeEvacFlare();
      screensMgr.showInGameRadio('[COMMAND]', '"Goliath neutralized! Hot extraction bird inbound to West Helipad! Move to the LZ, NOW!"', 6.0);
      tacticalRadioAudio.speakRadioLine('COMMAND', 'Goliath neutralized! Hot extraction bird inbound to West Helipad! Move to the LZ, NOW!');
      showKillBanner('JUGGERNAUT ELIMINATED // MOVE TO EVAC LZ');
      updateObjectiveHud();
      return;
    }

    // Spawn Lootable Tactical Supply Pack (+25 Armor & Ammo Resupply) at eliminated enemy position!
    const lootGroup = new THREE.Group();
    const packBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x243447, roughness: 0.45, metalness: 0.65 })
    );
    const packGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.05, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    packGlow.position.y = 0.12;
    lootGroup.add(packBox, packGlow);
    lootGroup.position.set(enemy.root.position.x, enemy.baseY + 0.16, enemy.root.position.z);
    scene.add(lootGroup);
    activeLootDrops.push({
      mesh: lootGroup,
      position: lootGroup.position.clone(),
      age: 0,
      collected: false,
    });

    if (enemy.name.includes('Sniper') && !narrativeState.sniperDown) {
      narrativeState.sniperDown = true;
      tacticalRadioAudio.speakRadioLine('GHOST', 'Sniper neutralized! High ground is secure.');
      screensMgr.showInGameRadio('[GHOST]', '"Sniper neutralized! High catwalk is secure, good shooting!"', 4.0);
    }

    if (isHeadshot) {
      player.headshots++;
      // Physical Ballistic Helmet Pop-Off on Headshot Kill!
      const helmetNode = enemy.root.getObjectByName('Tactical_Helmet_Rigid');
      const visorNode = enemy.root.getObjectByName('Tactical_Visor_Rigid');
      if (helmetNode) helmetNode.visible = false;
      if (visorNode) visorNode.visible = false;
      const flyHelmet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.12, 0.13, 12),
        new THREE.MeshStandardMaterial({ color: 0x3b4834, roughness: 0.45, metalness: 0.55 })
      );
      flyHelmet.position.copy(hitPos);
      scene.add(flyHelmet);
      activeShells.push({
        mesh: flyHelmet,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3.2, 4.8 + Math.random() * 1.5, (Math.random() - 0.5) * 3.2),
        rotVel: new THREE.Vector3(14, 19, 12),
        age: -0.65, // Keep flying helmet alive for ~1.4 seconds
      });
      audioSys.play3D('assets/audio/impact_metal.wav', hitPos, player.pos, 8, 45, 0.95);
    }
    player.multiKillCount++;
    player.multiKillTimer = 3.5;

    pushKillfeed(weaponLabel, enemy.name, isHeadshot);
    if (player.multiKillCount >= 3) {
      showKillBanner('TRIPLE KILL +100');
    } else if (player.multiKillCount === 2) {
      showKillBanner('DOUBLE KILL +150');
    } else if (isHeadshot) {
      showKillBanner('HEADSHOT +150');
    } else {
      showKillBanner('ELIMINATED +100');
    }
    updateObjectiveHud();
    if (enemies.every((e) => e.state === 'DEAD')) {
      if (player.gameMode === 'RAID') {
        if (!bossSpawned && player.terminalHacked) {
          triggerBossPhase();
        }
      } else {
        setTimeout(() => openMissionCompleteModal(), 1200);
      }
    }
  } else {
    enemy.state = 'HIT';
    enemy.stateTimer = 0.42;
    playEnemyClip(enemy, isHeadshot ? 'Hit_Head' : 'Hit_Chest', false);
  }
}

const raycaster = new THREE.Raycaster();
const shellGeo = new THREE.CylinderGeometry(0.0055, 0.006, 0.028, 8);
const shellMat = new THREE.MeshStandardMaterial({ color: 0xd8a838, roughness: 0.22, metalness: 0.92 });
const sgShellGeo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.042, 8);
const sgShellMat = new THREE.MeshStandardMaterial({ color: 0xc8221e, roughness: 0.45, metalness: 0.25 });

function spawnEjectedShellAndTracer(camDir: THREE.Vector3, targetPoint: THREE.Vector3, isShotgun = false, ejectShell = true) {
  const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3(0, 1, 0);

  // 1. Eject Rotating Brass or Red 12-Gauge Shotgun Shell Casing to the Right
  if (ejectShell) {
    const ejectPos = camera.position
      .clone()
      .addScaledVector(camDir, 0.42)
      .addScaledVector(right, 0.18)
      .addScaledVector(up, -0.12);

    const shellMesh = new THREE.Mesh(isShotgun ? sgShellGeo : shellGeo, isShotgun ? sgShellMat : shellMat);
    shellMesh.position.copy(ejectPos);
    shellMesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(shellMesh);
    activeShells.push({
      mesh: shellMesh,
      vel: right
        .clone()
        .multiplyScalar(2.4 + Math.random() * 0.8)
        .addScaledVector(up, 1.8 + Math.random() * 0.6)
        .addScaledVector(camDir, -0.5),
      rotVel: new THREE.Vector3(18, 24, 15),
      age: 0,
    });
  }

  // 2. High-Velocity Ballistic Tracer Streak from Muzzle to Target
  const muzzleWorld = camera.position
    .clone()
    .addScaledVector(camDir, 0.75)
    .addScaledVector(right, player.ads ? 0.0 : 0.16)
    .addScaledVector(up, -0.11);
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([muzzleWorld, targetPoint]);
  const tracerMat = new THREE.LineBasicMaterial({
    color: isShotgun ? 0xffae42 : 0xffd266,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(tracerGeo, tracerMat);
  scene.add(line);
  activeTracers.push({ line, age: 0 });
}

function performSingleHitscanRay(rayDir: THREE.Vector3, w: WeaponSpec, isShotgun: boolean, ejectShell: boolean) {
  raycaster.set(camera.position, rayDir);

  // 0. Check Suspended Crane Container Release Shackle!
  if (suspendedCargo && suspendedCargo.state === 'SUSPENDED') {
    const shackleHits = raycaster.intersectObject(suspendedCargo.shackleMesh, false);
    if (shackleHits.length > 0 && shackleHits[0].distance < 95) {
      spawnEjectedShellAndTracer(rayDir, shackleHits[0].point, isShotgun, ejectShell);
      releaseSuspendedCargoContainer();
      return true;
    }
  }

  // 1. Check Explosive Barrels
  for (const barrel of explosiveBarrels) {
    if (barrel.exploded) continue;
    const hits = raycaster.intersectObject(barrel.mesh, false);
    if (hits.length > 0 && hits[0].distance < 95) {
      spawnEjectedShellAndTracer(rayDir, hits[0].point, isShotgun, ejectShell);
      barrel.hp -= w.damage;
      if (ejectShell) audioSys.play3D('assets/audio/impact_metal.wav', hits[0].point, player.pos);
      if (barrel.hp <= 0) {
        barrel.exploded = true;
        barrel.mesh.visible = false;
        barrel.wreckGroup.visible = true;
        triggerExplosionAt(barrel.position, 8.0, 175);
      }
      return true;
    }
  }

  // 2. Check Enemy Soldiers (Analytical capsule + head sphere for reliable headshot detection)
  let bestEnemy: EnemyActor | null = null;
  let bestDist = Infinity;
  let bestHeadshot = false;

  for (const e of enemies) {
    if (e.state === 'DEAD') continue;
    const headCenter = e.root.position.clone().add(new THREE.Vector3(0, 1.62, 0));
    const bodyCenter = e.root.position.clone().add(new THREE.Vector3(0, 0.98, 0));

    const toHead = headCenter.clone().sub(camera.position);
    const projHead = toHead.dot(rayDir);
    if (projHead > 0 && projHead < bestDist) {
      const perpHeadSq = toHead.lengthSq() - projHead * projHead;
      if (perpHeadSq <= 0.26 * 0.26) {
        bestDist = projHead;
        bestEnemy = e;
        bestHeadshot = true;
        continue;
      }
    }

    const toBody = bodyCenter.clone().sub(camera.position);
    const projBody = toBody.dot(rayDir);
    if (projBody > 0 && projBody < bestDist) {
      const closestPt = camera.position.clone().addScaledVector(rayDir, projBody);
      const dx = closestPt.x - bodyCenter.x;
      const dz = closestPt.z - bodyCenter.z;
      const dy = Math.abs(closestPt.y - bodyCenter.y);
      if (dx * dx + dz * dz <= 0.42 * 0.42 && dy <= 0.85) {
        bestDist = projBody;
        bestEnemy = e;
        bestHeadshot = false;
      }
    }
  }

  if (bestEnemy) {
    const hitPt = bestEnemy.root.position.clone().add(new THREE.Vector3(0, bestHeadshot ? 1.62 : 1.05, 0));
    spawnEjectedShellAndTracer(rayDir, hitPt, isShotgun, ejectShell);
    const dmg = bestHeadshot ? w.damage * w.headshotMult : w.damage;
    damageEnemy(bestEnemy, dmg, bestHeadshot, w.name);
    return true;
  } else {
    let envTarget = camera.position.clone().addScaledVector(rayDir, 22);
    // Raycast against ground plane (y = 0) if aiming downward, or place bullet impact decal & ricochet spark
    if (rayDir.y < -0.02) {
      const tGround = (0.015 - camera.position.y) / rayDir.y;
      if (tGround > 0.5 && tGround < 32) {
        envTarget = camera.position.clone().addScaledVector(rayDir, tGround);
      }
    }
    spawnEjectedShellAndTracer(rayDir, envTarget, isShotgun, ejectShell);
    if (ejectShell) {
      // Place Pooled Bullet Impact Scorch Decal + Ricochet Spark Burst
      const decal = impactDecalPool[nextDecalIdx];
      nextDecalIdx = (nextDecalIdx + 1) % MAX_IMPACT_DECALS;
      decal.position.copy(envTarget);
      if (envTarget.y <= 0.06) {
        decal.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
      } else {
        decal.lookAt(camera.position);
      }
      decal.visible = true;

      const sparkMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 6, 6),
        new THREE.MeshBasicMaterial({
          color: 0xffcc44,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      sparkMesh.position.copy(envTarget);
      scene.add(sparkMesh);
      activeSmokePuffs.push({ mesh: sparkMesh, age: 0, maxAge: 0.22 });

      if (envTarget.y <= 0.15) {
        audioSys.play3D('assets/audio/impact_water.wav', envTarget, player.pos);
      } else {
        audioSys.play3D('assets/audio/impact_metal.wav', envTarget, player.pos);
      }
    }
    return false;
  }
}

function fireSingleRound(fromBurstQueue = false) {
  const w = WEAPONS[activeWeaponIdx];
  if (player.reloading) return;
  if (!fromBurstQueue && player.fireTimer > 0) return;
  if (w.mag <= 0) {
    player.burstRemaining = 0;
    startReload();
    return;
  }

  if (!fromBurstQueue && w.fireMode === 'BURST') {
    player.burstRemaining = Math.min(2, w.mag - 1);
    player.burstTimer = w.fireInterval * 0.82;
  }

  w.mag--;
  player.shotsFired++;
  player.fireTimer = w.fireInterval;
  player.recoilOffsetZ = w.recoilZ;
  player.recoilPitch = w.recoilPitch;
  muzzleFlashMesh.material.opacity = 0.95;
  muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
  muzzleLight.intensity = 18.0;
  muzzleLight.visible = true;
  audioSys.play2D(w.audioShot, 0.85);
  updateWeaponHud();

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);

  if (w.fireMode === 'ROCKET') {
    const rocketGroup = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.042, 0.48, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a4230, roughness: 0.45, metalness: 0.65 })
    );
    bodyMesh.rotation.x = Math.PI / 2;
    const plumeMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.38, 10),
      new THREE.MeshBasicMaterial({ color: 0xff9922, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })
    );
    plumeMesh.rotation.x = -Math.PI / 2;
    plumeMesh.position.z = -0.35;
    const rocketLight = new THREE.PointLight(0xff7718, 22, 14, 1.5);
    rocketLight.position.z = -0.35;
    rocketGroup.add(bodyMesh, plumeMesh, rocketLight);

    rocketGroup.position.copy(camera.position).addScaledVector(camDir, 0.95);
    rocketGroup.lookAt(rocketGroup.position.clone().add(camDir));
    scene.add(rocketGroup);
    activeRockets.push({
      mesh: rocketGroup,
      velocity: camDir.clone().multiplyScalar(38),
      age: 0,
      smokeTimer: 0,
    });
    if (w.mag === 0 && w.reserve > 0) setTimeout(() => startReload(), 350);
    return;
  }

  // Multi-pellet Buckshot Fan for SG-12 Shotgun vs Single Ray for Rifles/SMGs
  const pelletCount = w.pellets || 1;
  const spread = (w.spreadRad || 0) * (player.ads ? 0.55 : 1.0);
  const rightVec = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
  const upVec = new THREE.Vector3().crossVectors(rightVec, camDir).normalize();
  let anyHit = false;

  for (let p = 0; p < pelletCount; p++) {
    const rayDir = camDir.clone();
    if (pelletCount > 1 && p > 0) {
      // Deterministic golden-angle spiral spread pattern for consistent buckshot coverage
      const ang = p * 2.39996;
      const rad = spread * Math.sqrt(p / pelletCount);
      rayDir.addScaledVector(rightVec, Math.cos(ang) * rad).addScaledVector(upVec, Math.sin(ang) * rad).normalize();
    }
    const hit = performSingleHitscanRay(rayDir, w, pelletCount > 1, p === 0);
    if (hit) anyHit = true;
  }
  if (anyHit) player.shotsHit++;

  if (w.mag === 0 && w.reserve > 0) {
    setTimeout(() => startReload(), 250);
  }
}

function fireCurrentWeapon() {
  fireSingleRound(false);
}

// ---------------------------------------------------------------------------
// Tactical Grenade Throw ([G]), Quick Melee Buttstock Bash ([F]) & Damage Arc
// ---------------------------------------------------------------------------
function throwFragGrenade() {
  if (player.grenades <= 0 || loadoutOpen || missionModalOpen) return;
  player.grenades--;
  updateWeaponHud();
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.7);

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);

  const gGroup = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.068, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x3b4d28, roughness: 0.52, metalness: 0.45 })
  );
  body.scale.set(1.0, 1.22, 1.0);
  const lever = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.09, 0.035),
    new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.4, metalness: 0.8 })
  );
  lever.position.set(0.03, 0.04, 0);
  const blinkLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.024, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3311 })
  );
  blinkLed.position.set(0, 0.09, 0);
  gGroup.add(body, lever, blinkLed);

  gGroup.position.copy(camera.position).addScaledVector(camDir, 0.65);
  scene.add(gGroup);

  const throwVel = camDir.clone().multiplyScalar(17.5);
  throwVel.y += 4.2;
  activeGrenades.push({
    mesh: gGroup,
    vel: throwVel,
    age: 0,
    fuseTime: 1.85,
    bounced: false,
  });
}

function triggerMeleeBash() {
  if (player.meleeTimer > 0 || loadoutOpen || missionModalOpen) return;
  player.meleeTimer = 0.36;
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.9);

  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);

  for (const e of enemies) {
    if (e.state === 'DEAD') continue;
    const toEnemy = e.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)).sub(camera.position);
    const dist = toEnemy.length();
    if (dist <= 2.85 && toEnemy.normalize().dot(camDir) > 0.45) {
      audioSys.play3D('assets/audio/impact_concrete.wav', e.root.position, player.pos, 6, 30, 1.0);
      e.root.position.addScaledVector(camDir, 0.85);
      damageEnemy(e, 70, false, '近戰槍托擊 (MELEE)');
      break;
    }
  }
}

function toggleTacticalFlashlight() {
  player.flashlightOn = !player.flashlightOn;
  if (player.flashlightOn) {
    weaponMount.add(tacticalFlashlight);
  } else {
    weaponMount.remove(tacticalFlashlight);
  }
  tacticalFlashlight.visible = player.flashlightOn;
  tacticalFlashlight.intensity = player.flashlightOn ? 28 : 0;
  smgLaserBeam.visible = player.flashlightOn || Boolean(WEAPONS[activeWeaponIdx].hasGreenLaser);
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.8);
  updateWeaponHud();
}

function toggleNvgMode(forceState?: boolean) {
  player.nvgOn = forceState !== undefined ? forceState : !player.nvgOn;
  document.getElementById('nvg-overlay')?.classList.toggle('hidden', !player.nvgOn);
  renderer.toneMappingExposure = player.nvgOn ? 2.05 : 1.42;
  scene.environmentIntensity = player.nvgOn ? 2.55 : 1.75;
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.85);
  updateWeaponHud();
}

function triggerWeaponInspect() {
  if (player.reloading || player.ads || loadoutOpen || missionModalOpen) return;
  player.inspectTimer = 1.85;
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.7);
}

function useCombatMedStim() {
  if (player.stims <= 0 || player.hp >= player.maxHp || loadoutOpen || missionModalOpen) return;
  player.stims--;
  player.hp = Math.min(player.maxHp, player.hp + 45);
  audioSys.play2D('assets/audio/reload.wav', 0.85);
  showKillBanner('MED-STIM INJECTED +45 HP');
  updateStatusHud();
  updateWeaponHud();
  const vig = document.getElementById('damage-vignette');
  if (vig) {
    vig.style.boxShadow = 'inset 0 0 95px rgba(56, 189, 248, 0.45)';
    setTimeout(() => {
      vig.style.boxShadow = 'inset 0 0 110px rgba(220, 25, 20, 0)';
    }, 320);
  }
}

let damageArcTimeout: ReturnType<typeof setTimeout> | null = null;
function showDirectionalDamageArc(attackerPos: THREE.Vector3) {
  const arcEl = document.getElementById('damage-dir-arc');
  if (!arcEl) return;
  const dx = attackerPos.x - player.pos.x;
  const dz = attackerPos.z - player.pos.z;
  // Player forward is (-sin(yaw), 0, -cos(yaw))
  const worldAngle = Math.atan2(dx, -dz);
  const relAngleDeg = ((worldAngle + player.yaw) * 180) / Math.PI;
  arcEl.style.transform = `rotate(${relAngleDeg.toFixed(1)}deg)`;
  arcEl.classList.remove('hidden');
  if (damageArcTimeout) clearTimeout(damageArcTimeout);
  damageArcTimeout = setTimeout(() => {
    arcEl.classList.add('hidden');
  }, 550);
}

// ---------------------------------------------------------------------------
// 3D Gunsmith Interactive Workbench (Goal A) & Loadout Inspection
// ---------------------------------------------------------------------------
let loadoutOpen = false;
let missionModalOpen = false;
let activeGunsmithSlot: 'optic' | 'muzzle' | 'grip' | 'mag' = 'optic';

function syncWeaponAttachments(weaponId: string) {
  const prog = loadProgression();
  const eq = prog.weapons[weaponId]?.equippedAttachments || {};
  // 1. First-person viewmodel
  if (weaponModels[weaponId]) {
    gunsmithVisualizer.mountAttachmentsOnWeapon(weaponModels[weaponId] as THREE.Group, weaponId, eq);
  }
  // 2. Third-person weapon
  if (playerTpsWeapons[weaponId]) {
    gunsmithVisualizer.mountAttachmentsOnWeapon(playerTpsWeapons[weaponId] as THREE.Group, weaponId, eq);
  }
  updateWeaponHud();
}

function renderGunsmithAttachmentsList(weaponId: string, wState: any) {
  const listEl = document.getElementById('gunsmith-attachments-list');
  const titleEl = document.getElementById('gunsmith-slot-title');
  if (!listEl) return;
  listEl.innerHTML = '';

  const slotLabels: Record<string, string> = {
    optic: '🎯 瞄具配件庫 (OPTICS CATALOG)',
    muzzle: '🔇 槍口制動配件庫 (MUZZLE CATALOG)',
    grip: '握 戰術握把配件庫 (GRIP CATALOG)',
    mag: '🔋 供彈系統配件庫 (MAGAZINE CATALOG)',
  };
  if (titleEl) titleEl.textContent = slotLabels[activeGunsmithSlot] || '配件庫';

  const equippedId = wState.equippedAttachments[activeGunsmithSlot];

  // 1. None / Default card
  const noneCard = document.createElement('div');
  noneCard.className = `att-card ${!equippedId ? 'equipped' : ''}`;
  noneCard.innerHTML = `
    <div class="att-card-header">
      <span class="att-card-name">標準原廠規格 (DEFAULT)</span>
      ${!equippedId ? '<span class="att-badge-equipped">✓ ACTIVE</span>' : ''}
    </div>
    <p class="att-card-desc">移除此槽位改裝配件，恢復原廠原裝設定。</p>
    <button class="btn-att-action ${!equippedId ? 'btn-att-unequip' : 'btn-att-equip'}">
      ${!equippedId ? '✓ 已裝備 (EQUIPPED)' : '恢復原廠 (DEFAULT)'}
    </button>
  `;
  noneCard.querySelector('button')?.addEventListener('click', (e) => {
    e.stopPropagation();
    unequipAttachment(weaponId, activeGunsmithSlot);
    tacticalRadioAudio.playMechanicalGunsmithClick('unmount');
    syncWeaponAttachments(weaponId);
    updateLoadoutModal(activeWeaponIdx);
  });
  listEl.appendChild(noneCard);

  // 2. Catalog attachments
  const catalog = ATTACHMENTS_CATALOG.filter((a) => a.slot === activeGunsmithSlot);
  for (const att of catalog) {
    const isEq = equippedId === att.id;
    const isUnlocked = wState.level >= att.unlockLevel;
    const prog = loadProgression();
    const canAfford = prog.credits >= att.cost;
    const delta = getAttachmentComparison(weaponId, activeGunsmithSlot, att.id);

    const card = document.createElement('div');
    card.className = `att-card ${isEq ? 'equipped' : ''}`;

    let deltaHtml = '';
    if (delta.damageDelta !== 0) {
      deltaHtml += `<span class="${delta.damageDelta > 0 ? 'att-delta-pos' : 'att-delta-neg'}">${delta.damageDelta > 0 ? '+' : ''}${delta.damageDelta} 威力</span>`;
    }
    if (delta.recoilDeltaPct !== 0) {
      deltaHtml += `<span class="${delta.recoilDeltaPct < 0 ? 'att-delta-pos' : 'att-delta-neg'}">${delta.recoilDeltaPct > 0 ? '+' : ''}${delta.recoilDeltaPct}% 後座力</span>`;
    }
    if (delta.magDelta !== 0) {
      deltaHtml += `<span class="${delta.magDelta > 0 ? 'att-delta-pos' : 'att-delta-neg'}">${delta.magDelta > 0 ? '+' : ''}${delta.magDelta} 彈容</span>`;
    }
    if (delta.isSilenced) {
      deltaHtml += `<span class="att-delta-pos">🔇 匿蹤消音</span>`;
    }

    card.innerHTML = `
      <div class="att-card-header">
        <span class="att-card-name">${att.name}</span>
        ${isEq ? '<span class="att-badge-equipped">✓ EQUIPPED</span>' : `<span class="att-card-cost text-gold">${att.cost} CR</span>`}
      </div>
      <p class="att-card-desc">${att.desc}</p>
      <div class="att-stat-deltas">${deltaHtml}</div>
      <button class="btn-att-action ${isEq ? 'btn-att-unequip' : isUnlocked ? 'btn-att-equip' : canAfford ? 'btn-att-equip' : 'btn-att-locked'}">
        ${isEq ? '卸除 (REMOVE)' : isUnlocked ? '裝備 (EQUIP)' : canAfford ? `購買並裝備 (${att.cost} CR)` : `🔒 LV.${att.unlockLevel} 解鎖`}
      </button>
    `;

    card.querySelector('button')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isEq) {
        unequipAttachment(weaponId, activeGunsmithSlot);
        tacticalRadioAudio.playMechanicalGunsmithClick('unmount');
      } else if (isUnlocked || canAfford) {
        equipAttachment(weaponId, att.id);
        tacticalRadioAudio.playMechanicalGunsmithClick('mount');
      } else {
        return;
      }
      syncWeaponAttachments(weaponId);
      updateLoadoutModal(activeWeaponIdx);
    });

    listEl.appendChild(card);
  }
}

function updateLoadoutModal(idx: number) {
  const w = WEAPONS[idx];
  const cat = document.getElementById('loadout-cat');
  const name = document.getElementById('loadout-name');
  const desc = document.getElementById('loadout-desc');
  const lvlBadge = document.getElementById('loadout-level-badge');
  const creditsVal = document.getElementById('gunsmith-credits-val');
  if (cat) cat.textContent = w.category;
  if (name) name.textContent = w.name;
  if (desc) desc.textContent = w.desc;

  const prog = loadProgression();
  const wState = prog.weapons[w.id] || { level: 1, exp: 0, equippedAttachments: {} };
  if (lvlBadge) lvlBadge.textContent = `LV. ${wState.level}`;
  if (creditsVal) creditsVal.textContent = `${prog.credits.toLocaleString()} CR`;

  // Compute effective stats
  const eff = calculateWeaponEffectiveStats(w, w.id);

  const setBar = (id: string, val: number, max = 100) => {
    const bar = document.getElementById(id);
    const v = document.getElementById(`${id}-v`);
    if (bar) bar.style.width = `${Math.min(100, (val / max) * 100)}%`;
    if (v) v.textContent = String(val);
  };
  setBar('stat-dmg', eff.damage);
  setBar('stat-rof', w.stats.rof);
  setBar('stat-stb', Math.round(100 - eff.recoilPitch * 1400));
  setBar('stat-rng', w.stats.rng);
  setBar('stat-cap', eff.magSize, 50);

  document.querySelectorAll('.loadout-tab').forEach((btn, bIdx) => {
    btn.classList.toggle('active', bIdx === idx);
  });

  // Update 3D showcase mesh in front of camera
  loadoutWeaponHolder.clear();
  if (weaponModels[w.id]) {
    const preview = weaponModels[w.id].clone(true);
    preview.visible = true;
    preview.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });
    preview.scale.setScalar(1.52);
    preview.rotation.set(0.14, Math.PI * 0.42, -0.05);

    // Mount 3D attachments onto the showcase preview!
    gunsmithVisualizer.mountAttachmentsOnWeapon(preview as THREE.Group, w.id, wState.equippedAttachments);
    loadoutWeaponHolder.add(preview);
  }
  loadoutShowcaseGroup.position.set(0.24, -0.02, -0.94);

  // Render Slot Tabs (Optic, Muzzle, Grip, Mag)
  const slotTabs = document.querySelectorAll('.slot-tab');
  slotTabs.forEach((tab) => {
    const s = (tab as HTMLElement).dataset.slot as 'optic' | 'muzzle' | 'grip' | 'mag';
    tab.classList.toggle('active', s === activeGunsmithSlot);
  });

  // Render Attachment List for active slot
  renderGunsmithAttachmentsList(w.id, wState);
}

function toggleLoadoutModal(force?: boolean) {
  loadoutOpen = force !== undefined ? force : !loadoutOpen;
  document.getElementById('loadout-modal')?.classList.toggle('hidden', !loadoutOpen);
  document.getElementById('hud')?.classList.toggle('hidden', loadoutOpen || missionModalOpen);
  fpRig.visible = !player.thirdPerson && !loadoutOpen && !missionModalOpen && !player.fixedCameraKey;
  if (playerTpsRoot) playerTpsRoot.visible = player.thirdPerson && !loadoutOpen && !missionModalOpen;
  loadoutShowcaseGroup.visible = loadoutOpen;
  loadoutKeyLight.visible = loadoutOpen;
  loadoutRimLight.visible = loadoutOpen;
  loadoutFillLight.visible = loadoutOpen;
  loadoutFrontSpot.visible = loadoutOpen;
  if (loadoutOpen) {
    camera.add(loadoutShowcaseGroup);
    updateLoadoutModal(activeWeaponIdx);
    if (document.pointerLockElement) document.exitPointerLock();
  } else {
    camera.remove(loadoutShowcaseGroup);
  }
}

// ---------------------------------------------------------------------------
// Goal B: Boss Encounter (Juggernaut Goliath-01) & Hot Evacuation
// ---------------------------------------------------------------------------
let bossActive = false;
let bossDefeated = false;
let bossSpawned = false;
let bossActorRef: EnemyActor | null = null;
let greenSmokeGroup: THREE.Group | null = null;
let emergencyAlarmActive = false;
let emergencyAlarmTimer = 0;

function spawnJuggernautBoss() {
  if (bossSpawned || !soldierTemplateGltf) return;
  bossSpawned = true;
  bossActive = true;

  const cloned = SkeletonUtils.clone(soldierTemplateGltf.scene) as THREE.Group;
  cloned.scale.setScalar(1.35);

  cloned.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = obj as THREE.Mesh;
      m.castShadow = true;
      m.receiveShadow = true;
      if (m.material) {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.color.setHex(0x111620);
        mat.metalness = 0.88;
        mat.roughness = 0.28;
        m.material = mat;
      }
    }
  });

  const mixer = new THREE.AnimationMixer(cloned);
  const actions: Record<string, THREE.AnimationAction> = {};
  soldierTemplateGltf.animations.forEach((clip: THREE.AnimationClip) => {
    actions[clip.name] = mixer.clipAction(clip);
  });

  const mfMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0 });
  const mf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mfMat);
  mf.position.set(0.35, 0.85, 0.95);
  cloned.add(mf);

  // Ballistic Riot Shield
  const shieldGroup = new THREE.Group();
  shieldGroup.name = 'Juggernaut_Riot_Shield';
  const shieldPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.05, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x161c24, roughness: 0.35, metalness: 0.88 })
  );
  const shieldGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75, roughness: 0.1 })
  );
  shieldGlass.position.set(0, 0.32, 0.028);
  const chevron = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.05, 0.055),
    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
  );
  chevron.position.set(0, -0.28, 0);
  shieldGroup.add(shieldPlate, shieldGlass, chevron);
  shieldGroup.position.set(-0.35, 0.95, 0.42);
  shieldGroup.rotation.y = 0.22;
  cloned.add(shieldGroup);

  // Heavy LMG / Minigun
  const lmgGroup = new THREE.Group();
  const lmgBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.18, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x0c0f14, metalness: 0.92, roughness: 0.25 })
  );
  const barrelCluster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 0.58, 8),
    new THREE.MeshStandardMaterial({ color: 0x1f2530, metalness: 0.95, roughness: 0.2 })
  );
  barrelCluster.rotation.x = Math.PI / 2;
  barrelCluster.position.set(0, 0, -0.45);
  lmgGroup.add(lmgBody, barrelCluster);
  lmgGroup.position.set(0.35, 0.85, 0.35);
  cloned.add(lmgGroup);

  const bossSpawnPos = new THREE.Vector3(12.5, 0.2, -18.5);
  cloned.position.copy(bossSpawnPos);
  scene.add(cloned);

  const actor: EnemyActor = {
    id: 'boss_juggernaut',
    name: 'PMC JUGGERNAUT [GOLIATH-01]',
    archetype: 'JUGGERNAUT',
    root: cloned,
    mixer,
    actions,
    activeClip: '',
    hp: 1200,
    maxHp: 1200,
    state: 'COMBAT',
    stateTimer: 0,
    fireCooldown: 0.4,
    patrolPoints: [[bossSpawnPos.x, bossSpawnPos.z]],
    patrolIdx: 0,
    baseY: bossSpawnPos.y,
    muzzleFlash: mf,
    shieldGroup,
    isStaggered: false,
    staggerTimer: 0,
  };

  playEnemyClip(actor, 'Combat_Idle', true);
  enemies.push(actor);
  bossActorRef = actor;

  // Trigger emergency siren and red alert
  emergencyAlarmActive = true;
  tacticalRadioAudio.playEmergencySiren(8.0);

  // Show Boss HUD Card
  const bossCard = document.getElementById('boss-hud-card');
  const bossHpText = document.getElementById('boss-hp-text');
  const bossHpFill = document.getElementById('boss-hp-fill');
  const bossHpGhost = document.getElementById('boss-hp-ghost');
  if (bossCard) bossCard.classList.remove('hidden');
  if (bossHpText) bossHpText.textContent = '1200 / 1200 HP';
  if (bossHpFill) bossHpFill.style.width = '100%';
  if (bossHpGhost) bossHpGhost.style.width = '100%';

  screensMgr.showInGameRadio('[COMMAND]', '"WARNING! Alert level RED! Heavy Juggernaut inbound at Crane Gantry!"', 6.0);
  tacticalRadioAudio.speakRadioLine('COMMAND', 'WARNING! Alert level RED! Hostile heavy reinforcements detected advancing from Crane Gantry Sector 3!');
  tacticalRadioAudio.speakRadioLine('GHOST', 'Look at the size of that guy... Juggernaut on the catwalk! Heavy armor and riot shield! Flank his six or use rockets to break his guard!');

  updateObjectiveHud();
}

function triggerBossPhase() {
  if (bossSpawned) return;
  player.raidStage = 4;
  spawnJuggernautBoss();
}

function spawnGreenSmokeEvacFlare() {
  if (greenSmokeGroup) return;
  greenSmokeGroup = new THREE.Group();
  greenSmokeGroup.position.set(-18, 0.2, 38);

  const canMat = new THREE.MeshStandardMaterial({ color: 0x166534, metalness: 0.8, roughness: 0.3 });
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.38, 12), canMat);
  can.position.y = 0.19;
  greenSmokeGroup.add(can);

  const greenLight = new THREE.PointLight(0x22c55e, 14, 18, 1.2);
  greenLight.position.set(0, 1.2, 0);
  greenSmokeGroup.add(greenLight);

  for (let i = 0; i < 8; i++) {
    const sMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.35 - i * 0.03,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sMesh = new THREE.Mesh(new THREE.CircleGeometry(0.8 + i * 0.35, 12), sMat);
    sMesh.position.set(
      (Math.random() - 0.5) * 0.8,
      0.8 + i * 0.55,
      (Math.random() - 0.5) * 0.8
    );
    sMesh.rotation.x = Math.PI * 0.45;
    greenSmokeGroup.add(sMesh);
  }

  scene.add(greenSmokeGroup);
  tacticalRadioAudio.playGreenSmokeIgnition();
}

function launchHotEvacuation() {
  if (evacuationDirector.active || missionModalOpen) return;
  fpRig.visible = false;
  if (playerTpsRoot) playerTpsRoot.visible = false;
  if (stealthHeli) stealthHeli.group.visible = true;
  document.getElementById('hud')?.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();

  evacuationDirector.play(() => {
    if (stealthHeli) stealthHeli.group.visible = false;
    openMissionCompleteModal();
  });
}

function loadAndApplyCustomHudLayout() {
  if (typeof localStorage === 'undefined') return;
  const layoutStr = localStorage.getItem('firegun_hud_layout_v1');
  if (layoutStr) {
    try {
      const layout = JSON.parse(layoutStr);
      for (const [id, item] of Object.entries(layout) as [string, { leftPct: number; topPct: number; scale: number; opacity: number }][]) {
        const el = document.getElementById(id);
        if (el) {
          el.style.position = 'fixed';
          el.style.left = `${item.leftPct}%`;
          el.style.top = `${item.topPct}%`;
          el.style.bottom = 'auto';
          el.style.right = 'auto';
          el.style.transform = `scale(${item.scale})`;
          el.style.opacity = String(item.opacity);
        }
      }
    } catch {
      // ignore
    }
  }

  const gyroStr = localStorage.getItem('firegun_gyro_config_v1');
  if (gyroStr) {
    try {
      const cfg = JSON.parse(gyroStr);
      if (typeof cfg.yawSens === 'number') gyroController.yawSens = cfg.yawSens;
      if (typeof cfg.pitchSens === 'number') gyroController.pitchSens = cfg.pitchSens;
      if (typeof cfg.deadzone === 'number') gyroController.deadzone = cfg.deadzone;
      if (typeof cfg.invertPitch === 'boolean') gyroController.invertPitch = cfg.invertPitch;
      if (typeof cfg.aimAssist === 'boolean') gyroController.aimAssist = cfg.aimAssist;
    } catch {
      // ignore
    }
  }
}

function openMissionCompleteModal() {
  missionModalOpen = true;
  document.getElementById('mission-modal')?.classList.remove('hidden');
  document.getElementById('hud')?.classList.add('hidden');
  fpRig.visible = false;
  if (playerTpsRoot) playerTpsRoot.visible = false;
  if (document.pointerLockElement) document.exitPointerLock();

  const elapsedSec = Math.max(12, Math.round((performance.now() - player.startTime) / 1000));
  const mins = Math.floor(elapsedSec / 60);
  const secs = String(elapsedSec % 60).padStart(2, '0');
  const acc = player.shotsFired > 0 ? Math.round((player.shotsHit / player.shotsFired) * 100) : 78;

  const setTxt = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt('m-time', `${mins}:${secs}`);
  setTxt('m-kills', String(Math.max(player.kills, enemies.filter((e) => e.state === 'DEAD').length)));
  setTxt('m-acc', `${acc}%`);
  setTxt('m-hs', String(player.headshots));
  setTxt('m-dmg', String(Math.round(player.damageTaken)));

  // Cycle 12: Show AAA After-Action Report (AAR) & Rewards Screen
  const matchStats = {
    clearTimeSec: elapsedSec,
    totalKills: Math.max(player.kills, enemies.filter((e) => e.state === 'DEAD').length),
    headshots: player.headshots,
    damageTaken: player.damageTaken,
    alliesAlive: squadMgr ? squadMgr.getAlliesAliveCount() : 2,
  };
  screensMgr.showRewardScreen(matchStats, {
    onRedeploy: () => {
      window.location.reload();
    },
    onGunsmith: () => {
      toggleLoadoutModal(true);
    },
    onMainMenu: () => {
      window.location.reload();
    },
  });
}

// ---------------------------------------------------------------------------
// Mobile Gyroscope Aiming Controller (DeviceOrientation / DeviceMotion + Touch UI)
// ---------------------------------------------------------------------------
const gyroController = {
  enabled: false,
  aimAssist: false, // Default OFF to ensure 100% deterministic control without phantom pulling
  sensitivity: 2.2,
  yawSens: 2.2,
  pitchSens: 2.2,
  deadzone: 0.02,
  invertPitch: false,
  yawMult: 1.0,
  pitchMult: 0.95,
  accelGain: 1.35,
  accelThreshold: 12.0, // deg/s threshold for non-linear flick acceleration
  calibrated: false,
  baseAlpha: 0,
  baseBeta: 0,
  baseGamma: 0,
  lastAlpha: 0,
  lastBeta: 0,
  lastGamma: 0,
  hasSample: false,
};

// Gyroscope Aim Assist: Pure friction slowdown (0.85x) on target. Absolutely ZERO magnetic camera pull/yaw displacement!
function applyGyroAimAssistToDelta(rawYawDelta: number, rawPitchDelta: number): [number, number] {
  if (!gyroController.aimAssist) return [rawYawDelta, rawPitchDelta];
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  let bestDot = 0.988; // Strict ~9 deg cone directly on crosshair
  let hasTargetInCrosshair = false;
  for (const e of enemies) {
    if (e.state === 'DEAD') continue;
    const chestPos = e.root.position.clone().add(new THREE.Vector3(0, 1.25, 0));
    const toE = chestPos.sub(camera.position);
    const dist = toE.length();
    if (dist > 45 || dist < 1.0) continue;
    const dot = toE.normalize().dot(camDir);
    if (dot > bestDot) {
      hasTargetInCrosshair = true;
      break;
    }
  }
  if (!hasTargetInCrosshair) return [rawYawDelta, rawPitchDelta];

  // Pure friction slowdown (0.85x) so player doesn't overshoot. NO target pulling!
  const slowdown = 0.85;
  return [rawYawDelta * slowdown, rawPitchDelta * slowdown];
}

function updateGyroHudButtons() {
  const toggleBtn = document.getElementById('btn-gyro-toggle');
  const sensBtn = document.getElementById('btn-gyro-sens');
  const autoBtn = document.getElementById('btn-autofire-toggle');
  const minBtn = document.getElementById('btn-hud-minimal');
  if (toggleBtn) {
    toggleBtn.textContent = gyroController.enabled ? '🧭 陀螺儀: ON' : '🧭 陀螺儀瞄準: 點擊開啟';
    toggleBtn.classList.toggle('active', gyroController.enabled);
  }
  document.getElementById('touch-btn-gyro-quick')?.classList.toggle('active', gyroController.enabled);
  if (sensBtn) {
    sensBtn.textContent = `${gyroController.sensitivity.toFixed(1)}x`;
  }
  if (autoBtn) {
    autoBtn.textContent = `🤖 自動開火: ${player.autoFireOn ? 'ON' : 'OFF'}`;
    autoBtn.classList.toggle('active', player.autoFireOn);
  }
  if (minBtn) {
    minBtn.textContent = player.hudMinimal ? '👁️ 完整' : '👁️ 精簡';
    minBtn.classList.toggle('active', player.hudMinimal);
  }
}

function calibrateGyroCenter() {
  if (gyroController.hasSample) {
    gyroController.baseAlpha = gyroController.lastAlpha;
    gyroController.baseBeta = gyroController.lastBeta;
    gyroController.baseGamma = gyroController.lastGamma;
    gyroController.calibrated = true;
  }
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.7);
  showKillBanner('GYRO CENTER CALIBRATED');
}

async function toggleGyroAiming(forceState?: boolean) {
  const target = forceState !== undefined ? forceState : !gyroController.enabled;
  if (target) {
    const DevOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (DevOrient && typeof DevOrient.requestPermission === 'function') {
      try {
        const perm = await DevOrient.requestPermission();
        if (perm !== 'granted') {
          showKillBanner('請允許瀏覽器動態感測器權限');
          return;
        }
      } catch {
        // Ignore
      }
    }
    gyroController.enabled = true;
    calibrateGyroCenter();
    showKillBanner('🧭 陀螺儀體感瞄準：已開啟 (2.2x 非線性加速)');
  } else {
    gyroController.enabled = false;
    showKillBanner('🧭 陀螺儀體感瞄準：已關閉');
  }
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.75);
  updateGyroHudButtons();
}

function toggleAutoFireAssist(forceState?: boolean) {
  player.autoFireOn = forceState !== undefined ? forceState : !player.autoFireOn;
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.75);
  showKillBanner(player.autoFireOn ? '🤖 準星自動開火：ON' : '🤖 準星自動開火：OFF');
  updateGyroHudButtons();
}

function toggleMinimalHud(forceState?: boolean) {
  player.hudMinimal = forceState !== undefined ? forceState : !player.hudMinimal;
  document.getElementById('hud')?.classList.toggle('hud-minimal', player.hudMinimal);
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.7);
  updateGyroHudButtons();
}

function toggleTacticalDrawer(forceState?: boolean) {
  player.drawerOpen = forceState !== undefined ? forceState : !player.drawerOpen;
  document.getElementById('touch-tactical-drawer')?.classList.toggle('hidden', !player.drawerOpen);
  document.getElementById('touch-btn-drawer')?.classList.toggle('active', player.drawerOpen);
  audioSys.play2D('assets/audio/fire_mode_click.wav', 0.65);
}

window.addEventListener('deviceorientation', (ev) => {
  if (ev.alpha === null || ev.beta === null || ev.gamma === null) return;
  const prevA = gyroController.lastAlpha;
  const prevB = gyroController.lastBeta;
  const prevG = gyroController.lastGamma;
  gyroController.lastAlpha = ev.alpha;
  gyroController.lastBeta = ev.beta;
  gyroController.lastGamma = ev.gamma;

  if (!gyroController.hasSample) {
    gyroController.hasSample = true;
    calibrateGyroCenter();
    return;
  }
  if (!gyroController.enabled || loadoutOpen || missionModalOpen || player.fixedCameraKey) return;

  // Handle wraparound on compass alpha (0..360)
  let dAlpha = ev.alpha - prevA;
  if (dAlpha > 180) dAlpha -= 360;
  if (dAlpha < -180) dAlpha += 360;
  const dBeta = ev.beta - prevB;
  const dGamma = ev.gamma - prevG;

  // Compensate for screen orientation (Portrait vs Landscape 90/-90)
  const orientAngle = window.screen?.orientation?.angle || 0;
  let yawDegDelta = dAlpha * 0.65 - dGamma * 0.35;
  let pitchDegDelta = dBeta;
  if (orientAngle === 90) {
    yawDegDelta = dAlpha * 0.7 - dBeta * 0.35;
    pitchDegDelta = -dGamma;
  } else if (orientAngle === -90 || orientAngle === 270) {
    yawDegDelta = dAlpha * 0.7 + dBeta * 0.35;
    pitchDegDelta = dGamma;
  }

  // Non-linear acceleration curve calculation
  let absYaw = Math.abs(yawDegDelta);
  let absPitch = Math.abs(pitchDegDelta);

  // Deadzone filter to suppress micro hand tremors
  if (absYaw < gyroController.deadzone * 57.3) {
    yawDegDelta = 0;
    absYaw = 0;
  }
  if (absPitch < gyroController.deadzone * 57.3) {
    pitchDegDelta = 0;
    absPitch = 0;
  }
  if (gyroController.invertPitch) {
    pitchDegDelta = -pitchDegDelta;
  }

  const accelYaw = absYaw > gyroController.accelThreshold ? Math.pow(absYaw / gyroController.accelThreshold, 1.35) : 1.0;
  const accelPitch = absPitch > gyroController.accelThreshold ? Math.pow(absPitch / gyroController.accelThreshold, 1.35) : 1.0;
  const adsScale = player.ads ? 0.65 : 1.0;

  const radScaleYaw = (Math.PI / 180) * (gyroController.yawSens || gyroController.sensitivity) * gyroController.yawMult * accelYaw * adsScale;
  const radScalePitch = (Math.PI / 180) * (gyroController.pitchSens || gyroController.sensitivity) * gyroController.pitchMult * accelPitch * adsScale;
  const [adjYaw, adjPitch] = applyGyroAimAssistToDelta(yawDegDelta * radScaleYaw, pitchDegDelta * radScalePitch);
  player.yaw += adjYaw;
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch + adjPitch));
});

// Also support high-frequency gyroscope angular velocity (`devicemotion.rotationRate`) on mobile devices
window.addEventListener('devicemotion', (ev) => {
  if (!gyroController.enabled || gyroController.hasSample || !ev.rotationRate) return;
  if (loadoutOpen || missionModalOpen || player.fixedCameraKey) return;
  const alphaRate = ev.rotationRate.alpha || 0;
  const betaRate = ev.rotationRate.beta || 0;
  const dtMotion = (ev.interval || 16) / 1000;

  let absYaw = Math.abs(betaRate * dtMotion);
  let absPitch = Math.abs(alphaRate * dtMotion);
  let effBeta = betaRate;
  let effAlpha = gyroController.invertPitch ? -alphaRate : alphaRate;

  if (absYaw < gyroController.deadzone * dtMotion * 57.3) {
    effBeta = 0;
    absYaw = 0;
  }
  if (absPitch < gyroController.deadzone * dtMotion * 57.3) {
    effAlpha = 0;
    absPitch = 0;
  }

  const accelYaw = absYaw > (gyroController.accelThreshold * dtMotion) ? Math.pow(absYaw / (gyroController.accelThreshold * dtMotion), 1.35) : 1.0;
  const accelPitch = absPitch > (gyroController.accelThreshold * dtMotion) ? Math.pow(absPitch / (gyroController.accelThreshold * dtMotion), 1.35) : 1.0;
  const adsScale = player.ads ? 0.65 : 1.0;

  const radScaleYaw = (Math.PI / 180) * (gyroController.yawSens || gyroController.sensitivity) * gyroController.yawMult * accelYaw * adsScale;
  const radScalePitch = (Math.PI / 180) * (gyroController.pitchSens || gyroController.sensitivity) * gyroController.pitchMult * accelPitch * adsScale;
  const [adjYaw, adjPitch] = applyGyroAimAssistToDelta(effBeta * dtMotion * radScaleYaw, effAlpha * dtMotion * radScalePitch);
  player.yaw += adjYaw;
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch + adjPitch));
});

// Floating Instant Gyroscope Recenter
document.getElementById('touch-btn-gyro-recenter')?.addEventListener('click', (e) => {
  e.stopPropagation();
  calibrateGyroCenter();
});

// HUD & Gyro Customizer Opener
const openCustomHudEditor = () => {
  screensMgr.showHudEditor({
    gyroConfig: {
      yawSens: gyroController.yawSens,
      pitchSens: gyroController.pitchSens,
      deadzone: gyroController.deadzone,
      invertPitch: gyroController.invertPitch,
      aimAssist: gyroController.aimAssist,
    },
    onSave: (layout, gyro) => {
      gyroController.yawSens = gyro.yawSens;
      gyroController.pitchSens = gyro.pitchSens;
      gyroController.deadzone = gyro.deadzone;
      gyroController.invertPitch = gyro.invertPitch;
      gyroController.aimAssist = gyro.aimAssist;
      loadAndApplyCustomHudLayout();
      showKillBanner('HUD & GYRO CONFIG SAVED');
    },
    onReset: () => {
      for (const id of [
        'touch-joystick-zone',
        'touch-btn-fire',
        'touch-btn-ads',
        'touch-btn-reload',
        'touch-btn-swap',
        'touch-btn-jump',
        'touch-btn-crouch',
        'touch-btn-grenade',
        'touch-btn-gyro-recenter',
      ]) {
        const el = document.getElementById(id);
        if (el) {
          el.style.position = '';
          el.style.left = '';
          el.style.top = '';
          el.style.bottom = '';
          el.style.right = '';
          el.style.transform = '';
          el.style.opacity = '';
        }
      }
      gyroController.yawSens = 2.2;
      gyroController.pitchSens = 2.2;
      gyroController.deadzone = 0.02;
      gyroController.invertPitch = false;
      showKillBanner('HUD & GYRO RESTORED TO DEFAULT');
    },
  });
};

document.getElementById('btn-pause-hud-editor')?.addEventListener('click', () => {
  screensMgr.togglePause(false);
  openCustomHudEditor();
});
document.getElementById('touch-btn-hud-editor')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTacticalDrawer(false);
  openCustomHudEditor();
});
document.getElementById('btn-pause-gunsmith')?.addEventListener('click', () => {
  screensMgr.togglePause(false);
  toggleLoadoutModal(true);
});
const closeGunsmith = (e?: Event) => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  toggleLoadoutModal(false);
  if (!operationStarted) {
    screensMgr.showPortal(
      () => launchInfiltrationCutscene(),
      () => toggleLoadoutModal(true)
    );
  }
};
const closeBtn = document.getElementById('btn-gunsmith-close');
if (closeBtn) {
  closeBtn.onclick = closeGunsmith;
  closeBtn.ontouchend = closeGunsmith;
}


document.getElementById('btn-gyro-toggle')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleGyroAiming();
});
document.getElementById('btn-gyro-cal')?.addEventListener('click', (e) => {
  e.stopPropagation();
  calibrateGyroCenter();
});
document.getElementById('btn-gyro-sens')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const presets = [1.0, 1.5, 2.0, 0.6];
  const idx = presets.indexOf(gyroController.sensitivity);
  gyroController.sensitivity = presets[(idx + 1) % presets.length];
  updateGyroHudButtons();
});
document.getElementById('btn-autofire-toggle')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleAutoFireAssist();
});
document.getElementById('btn-hud-minimal')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMinimalHud();
});
document.getElementById('touch-btn-drawer')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTacticalDrawer();
});

// ---------------------------------------------------------------------------
// Multi-Touch Swipe-to-Look Aiming (Canvas + Fire/ADS Button Drag) & Joystick
// ---------------------------------------------------------------------------
const touchMoveVec = new THREE.Vector2(0, 0);
let joyPointerId: number | null = null;
let lookPointerId: number | null = null;
let lastLookX = 0;
let lastLookY = 0;
let lastCanvasTapMs = 0;

function applyTouchLookDelta(dxPx: number, dyPx: number) {
  if (loadoutOpen) {
    loadoutShowcaseGroup.rotation.y += dxPx * 0.012;
    return;
  }
  if (missionModalOpen || player.fixedCameraKey) return;
  const baseSens = player.ads ? (WEAPONS[activeWeaponIdx].id === 'sr9' ? 0.0014 : 0.0026) : 0.0046;
  // 1:1 direct finger tracking with zero phantom magnetism pulling
  player.yaw += -dxPx * baseSens;
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - dyPx * baseSens));
  const hintEl = document.getElementById('touch-look-hint');
  if (hintEl) hintEl.style.opacity = '0';
}

canvas.addEventListener('pointerdown', (e) => {
  audioSys.unlockAndPreload();
  if (e.pointerType === 'touch' || e.pointerType === 'pen' || window.innerWidth <= 1024) {
    // Double-tap on touch screen toggles ADS scope!
    const nowMs = performance.now();
    if (nowMs - lastCanvasTapMs < 280 && Math.hypot(e.clientX - lastLookX, e.clientY - lastLookY) < 36) {
      setAdsState(!player.ads);
    }
    lastCanvasTapMs = nowMs;

    if (lookPointerId === null && e.pointerId !== joyPointerId) {
      lookPointerId = e.pointerId;
      lastLookX = e.clientX;
      lastLookY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === lookPointerId) {
    const dx = e.clientX - lastLookX;
    const dy = e.clientY - lastLookY;
    lastLookX = e.clientX;
    lastLookY = e.clientY;
    applyTouchLookDelta(dx, dy);
  }
});

const releaseLookPointer = (e: PointerEvent) => {
  if (e.pointerId === lookPointerId) {
    lookPointerId = null;
  }
};
canvas.addEventListener('pointerup', releaseLookPointer);
canvas.addEventListener('pointercancel', releaseLookPointer);

const joyZone = document.getElementById('touch-joystick-zone');
const joyKnob = document.getElementById('touch-joystick-knob');
if (joyZone && joyKnob) {
  const updateJoy = (clientX: number, clientY: number) => {
    const rect = joyZone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    touchMoveVec.set(dx / maxR, -dy / maxR);
  };
  const resetJoy = (e: PointerEvent) => {
    if (e.pointerId !== joyPointerId) return;
    joyPointerId = null;
    joyKnob.style.transform = 'translate(0px, 0px)';
    touchMoveVec.set(0, 0);
  };
  joyZone.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    audioSys.unlockAndPreload();
    joyPointerId = e.pointerId;
    joyZone.setPointerCapture(e.pointerId);
    updateJoy(e.clientX, e.clientY);
  });
  joyZone.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyPointerId) updateJoy(e.clientX, e.clientY);
  });
  joyZone.addEventListener('pointerup', resetJoy);
  joyZone.addEventListener('pointercancel', resetJoy);
}

// Fire Button supports Hold-and-Drag to Aim & Recoil Control simultaneously!
let firePointerId: number | null = null;
let lastFireX = 0;
let lastFireY = 0;
const fireBtnEl = document.getElementById('touch-btn-fire');
fireBtnEl?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  audioSys.unlockAndPreload();
  firePointerId = e.pointerId;
  lastFireX = e.clientX;
  lastFireY = e.clientY;
  fireBtnEl.setPointerCapture(e.pointerId);
  mouseDownLeft = true;
  fireCurrentWeapon();
});
fireBtnEl?.addEventListener('pointermove', (e) => {
  if (e.pointerId === firePointerId) {
    const dx = e.clientX - lastFireX;
    const dy = e.clientY - lastFireY;
    lastFireX = e.clientX;
    lastFireY = e.clientY;
    applyTouchLookDelta(dx, dy);
  }
});
const releaseFireBtn = (e: PointerEvent) => {
  if (e.pointerId === firePointerId) {
    firePointerId = null;
    mouseDownLeft = false;
  }
};
fireBtnEl?.addEventListener('pointerup', releaseFireBtn);
fireBtnEl?.addEventListener('pointercancel', releaseFireBtn);

document.getElementById('touch-btn-ads')?.addEventListener('click', (e) => {
  e.stopPropagation();
  setAdsState(!player.ads);
  document.getElementById('touch-btn-ads')?.classList.toggle('active', player.ads);
});
document.getElementById('touch-btn-reload')?.addEventListener('click', (e) => {
  e.stopPropagation();
  startReload();
});
document.getElementById('touch-btn-grenade')?.addEventListener('click', (e) => {
  e.stopPropagation();
  throwFragGrenade();
  toggleTacticalDrawer(false);
});
document.getElementById('touch-btn-melee')?.addEventListener('click', (e) => {
  e.stopPropagation();
  triggerMeleeBash();
  toggleTacticalDrawer(false);
});
document.getElementById('touch-btn-mode')?.addEventListener('click', (e) => {
  e.stopPropagation();
  cycleFireMode();
});
document.getElementById('touch-btn-crouch')?.addEventListener('click', (e) => {
  e.stopPropagation();
  player.crouching = !player.crouching;
  updateStatusHud();
});
document.getElementById('touch-btn-jump')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (player.grounded) {
    player.vel.y = 6.2;
    player.grounded = false;
  }
  toggleTacticalDrawer(false);
});
document.getElementById('touch-btn-tps')?.addEventListener('click', (e) => {
  e.stopPropagation();
  setThirdPersonMode();
  toggleTacticalDrawer(false);
});
document.getElementById('touch-btn-loadout')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTacticalDrawer(false);
  toggleLoadoutModal(true);
});
document.getElementById('touch-btn-lean-l')?.addEventListener('click', (e) => {
  e.stopPropagation();
  player.leanTarget = player.leanTarget < -0.5 ? 0 : -1;
  updateStatusHud();
});
document.getElementById('touch-btn-lean-r')?.addEventListener('click', (e) => {
  e.stopPropagation();
  player.leanTarget = player.leanTarget > 0.5 ? 0 : 1;
  updateStatusHud();
});
document.getElementById('touch-btn-light')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTacticalFlashlight();
});
document.getElementById('touch-btn-nvg')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleNvgMode();
});
document.getElementById('touch-btn-inspect')?.addEventListener('click', (e) => {
  e.stopPropagation();
  triggerWeaponInspect();
  toggleTacticalDrawer(false);
});
document.getElementById('touch-btn-stim')?.addEventListener('click', (e) => {
  e.stopPropagation();
  useCombatMedStim();
});
document.getElementById('flashlight-badge')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTacticalFlashlight();
});
document.getElementById('nvg-badge')?.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleNvgMode();
});
document.getElementById('stim-badge')?.addEventListener('click', (e) => {
  e.stopPropagation();
  useCombatMedStim();
});

for (let s = 1; s <= 5; s++) {
  document.getElementById(`slot-${s}`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    equipWeapon(s - 1);
  });
}

let zKeyDownTime = 0;
let zKeyHeldTimer: ReturnType<typeof setTimeout> | null = null;

// Squad Command Wheel Buttons
document.querySelectorAll('.cw-slice').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const ord = (btn as HTMLElement).dataset.order as SquadOrder;
    if (ord) squadMgr.setOrder(ord);
    squadMgr.openCommandWheel(false);
  });
});

// Pause Menu Buttons
document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
  screensMgr.togglePause(false);
});
document.getElementById('btn-pause-records')?.addEventListener('click', () => {
  screensMgr.showRecords();
});
document.getElementById('btn-records-close')?.addEventListener('click', () => {
  screensMgr.hideRecords();
});
document.getElementById('btn-records-back')?.addEventListener('click', () => {
  screensMgr.hideRecords();
});
document.getElementById('btn-pause-restart')?.addEventListener('click', () => {
  screensMgr.togglePause(false);
  player.pos.set(blueprint.spawn.position[0], 0, blueprint.spawn.position[2]);
  player.hp = 100;
  player.armor = 150;
  spawnEnemySquad();
  squadMgr.initSquadMembers(soldierTemplateGltf!, scene, player.pos);
  updateStatusHud();
});
document.getElementById('btn-pause-main')?.addEventListener('click', () => {
  screensMgr.togglePause(false);
  screensMgr.showTitleScreen(() => {});
});

// ---------------------------------------------------------------------------
// Input Events
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  audioSys.unlockAndPreload();
  if (e.code === 'Escape') {
    screensMgr.togglePause();
  }
  if (e.code === 'KeyZ' && !zKeyDownTime) {
    zKeyDownTime = performance.now();
    zKeyHeldTimer = setTimeout(() => {
      squadMgr.openCommandWheel(true);
    }, 280);
  }
  if (e.code === 'Digit1') equipWeapon(0);
  if (e.code === 'Digit2') equipWeapon(1);
  if (e.code === 'Digit3') equipWeapon(2);
  if (e.code === 'Digit4') equipWeapon(3);
  if (e.code === 'Digit5') equipWeapon(4);
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyB') cycleFireMode();
  if (e.code === 'KeyG') throwFragGrenade();
  if (e.code === 'KeyF') triggerMeleeBash();
  if (e.code === 'KeyT') toggleTacticalFlashlight();
  if (e.code === 'KeyN') toggleNvgMode();
  if (e.code === 'KeyI') triggerWeaponInspect();
  if (e.code === 'KeyX') useCombatMedStim();
  if (e.code === 'KeyY') toggleGyroAiming();
  if (e.code === 'KeyH') toggleMinimalHud();
  if (e.code === 'KeyQ') {
    player.leanTarget = -1;
    updateStatusHud();
  }
  if (e.code === 'KeyE') {
    player.leanTarget = 1;
    updateStatusHud();
    // Check if player is near any downed squad mate to revive!
    for (const mate of squadMgr.squadMembers) {
      if (mate.downed && mate.root.position.distanceTo(player.pos) < 2.8) {
        squadMgr.reviveMember(mate.id);
        break;
      }
    }
  }
  if (e.code === 'KeyP') setThirdPersonMode();
  if (e.code === 'KeyC') {
    player.crouching = !player.crouching;
    updateStatusHud();
  }
  if (e.code === 'KeyL' || e.code === 'Tab') {
    e.preventDefault();
    toggleLoadoutModal();
  }
  if (e.code === 'KeyM') {
    if (missionModalOpen) {
      missionModalOpen = false;
      document.getElementById('mission-modal')?.classList.add('hidden');
      document.getElementById('hud')?.classList.remove('hidden');
      fpRig.visible = !player.thirdPerson && !player.fixedCameraKey;
      if (playerTpsRoot) playerTpsRoot.visible = player.thirdPerson;
    } else {
      openMissionCompleteModal();
    }
  }
  if (e.code === 'KeyV') {
    setAdsState(!player.ads);
  }
  if (e.code === 'Space' && player.grounded) {
    player.vel.y = 6.2;
    player.grounded = false;
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyZ') {
    if (zKeyHeldTimer) clearTimeout(zKeyHeldTimer);
    const duration = performance.now() - zKeyDownTime;
    zKeyDownTime = 0;
    if (duration < 280) {
      // Quick Contextual Order: Look at ground -> Move; Look at enemy -> Attack; Else -> Follow
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const groundTarget = player.pos.clone().addScaledVector(camDir, 14);
      groundTarget.y = 0;
      squadMgr.setOrder('MOVE_TO', groundTarget);
    } else {
      squadMgr.openCommandWheel(false);
    }
  }
  if (e.code === 'KeyQ' && player.leanTarget < 0) {
    player.leanTarget = keys['KeyE'] ? 1 : 0;
    updateStatusHud();
  }
  if (e.code === 'KeyE' && player.leanTarget > 0) {
    player.leanTarget = keys['KeyQ'] ? -1 : 0;
    updateStatusHud();
  }
});

function setAdsState(ads: boolean) {
  player.ads = ads;
  const w = WEAPONS[activeWeaponIdx];
  const scopeEl = document.getElementById('sniper-scope');
  const retEl = document.getElementById('reticle-wrap');
  if (ads && w.id === 'sr9') {
    scopeEl?.classList.remove('hidden');
    retEl?.classList.add('hidden');
    weaponMount.visible = false;
  } else {
    scopeEl?.classList.add('hidden');
    retEl?.classList.remove('hidden');
    weaponMount.visible = true;
  }
}

canvas.addEventListener('mousedown', (e) => {
  audioSys.unlockAndPreload();
  if (loadoutOpen || missionModalOpen) return;
  if (document.pointerLockElement !== canvas && !captureMode && !player.fixedCameraKey) {
    canvas.requestPointerLock?.();
  }
  if (e.button === 0) {
    mouseDownLeft = true;
    fireCurrentWeapon();
  } else if (e.button === 2) {
    setAdsState(true);
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseDownLeft = false;
  if (e.button === 2) setAdsState(false);
});

window.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('mousemove', (e) => {
  if (loadoutOpen) {
    if (e.buttons === 1) {
      loadoutShowcaseGroup.rotation.y += e.movementX * 0.01;
    }
    return;
  }
  if (document.pointerLockElement === canvas && !player.fixedCameraKey) {
    const sens = player.ads ? 0.0011 : 0.0022;
    player.yaw -= e.movementX * sens;
    player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - e.movementY * sens));
  }
});

document.querySelectorAll('.loadout-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = Number((btn as HTMLElement).dataset.wep || 0);
    equipWeapon(idx);
    updateLoadoutModal(idx);
  });
});

document.querySelectorAll('.slot-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    const s = (btn as HTMLElement).dataset.slot as 'optic' | 'muzzle' | 'grip' | 'mag';
    if (s) {
      activeGunsmithSlot = s;
      updateLoadoutModal(activeWeaponIdx);
    }
  });
});

document.getElementById('btn-retry')?.addEventListener('click', () => {
  missionModalOpen = false;
  document.getElementById('mission-modal')?.classList.add('hidden');
  document.getElementById('hud')?.classList.remove('hidden');
  player.pos.set(blueprint.spawn.position[0], 0, blueprint.spawn.position[2]);
  player.hp = 100;
  player.armor = 150;
  player.kills = 0;
  fpRig.visible = true;
  spawnEnemySquad();
  updateStatusHud();
});

document.getElementById('btn-continue')?.addEventListener('click', () => {
  missionModalOpen = false;
  document.getElementById('mission-modal')?.classList.add('hidden');
  document.getElementById('hud')?.classList.remove('hidden');
  fpRig.visible = true;
});

// ---------------------------------------------------------------------------
// 2D Tactical Minimap Renderer (Top-Left HUD)
// ---------------------------------------------------------------------------
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
const mmCtx = minimapCanvas.getContext('2d')!;

function renderMinimap() {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  mmCtx.clearRect(0, 0, w, h);

  mmCtx.fillStyle = '#090f17';
  mmCtx.fillRect(0, 0, w, h);

  mmCtx.save();
  mmCtx.translate(w / 2, h / 2);
  mmCtx.rotate(player.yaw);

  const scale = 2.4;
  const tx = (wx: number) => (wx - player.pos.x) * scale;
  const tz = (wz: number) => (wz - player.pos.z) * scale;

  // Sea on west side
  mmCtx.fillStyle = '#0c1c2c';
  mmCtx.fillRect(tx(-65), tz(-50), 42 * scale, 100 * scale);

  // Cargo Ship footprint
  mmCtx.fillStyle = '#2d3748';
  mmCtx.strokeStyle = '#64748b';
  mmCtx.lineWidth = 1.5;
  mmCtx.fillRect(tx(-41), tz(-40), 16 * scale, 66 * scale);
  mmCtx.strokeRect(tx(-41), tz(-40), 16 * scale, 66 * scale);

  // Container stacks & Warehouse footprint
  mmCtx.fillStyle = '#334155';
  const rects: [number, number, number, number][] = [
    [-3.0, 11, 7.6, 6.2],
    [-3.0, 1, 5.2, 6.2],
    [-3.0, -9, 5.6, 6.2],
    [6.2, -11, 2.6, 26],
    [12.0, -23, 14.0, 30], // Warehouse
    [12.8, 14.8, 3.4, 3.4], // Guard Post
  ];
  for (const [rx, rz, rw, rl] of rects) {
    mmCtx.fillRect(tx(rx), tz(rz), rw * scale, rl * scale);
  }

  // Objective Marker (North Terminal / Ship Boarding)
  mmCtx.fillStyle = '#facc15';
  mmCtx.beginPath();
  mmCtx.arc(tx(-4.0), tz(-18.0), 4.5, 0, Math.PI * 2);
  mmCtx.fill();

  // Loot Supply Drops on Minimap (Cyan Diamond)
  for (const ld of activeLootDrops) {
    if (ld.collected) continue;
    mmCtx.fillStyle = '#38bdf8';
    mmCtx.fillRect(tx(ld.position.x) - 2.5, tz(ld.position.z) - 2.5, 5, 5);
  }

  // Suspended / Dropped Crane Cargo Container on Minimap (Amber Hazard)
  if (suspendedCargo) {
    mmCtx.strokeStyle = suspendedCargo.state === 'SUSPENDED' ? '#f97316' : '#94a3b8';
    mmCtx.lineWidth = 1.4;
    mmCtx.strokeRect(
      tx(suspendedCargo.group.position.x - 1.25),
      tz(suspendedCargo.group.position.z - 3.0),
      2.5 * scale,
      6.0 * scale
    );
  }

  // Enemy Blips
  for (const e of enemies) {
    if (e.state === 'DEAD') continue;
    mmCtx.fillStyle = e.archetype === 'SNIPER' ? '#f43f5e' : e.archetype === 'BREACHER' ? '#fb923c' : '#ef4444';
    mmCtx.beginPath();
    mmCtx.arc(tx(e.root.position.x), tz(e.root.position.z), 3.6, 0, Math.PI * 2);
    mmCtx.fill();
  }

  mmCtx.restore();

  // Player Real-Time FOV Vision Cone (Facing North on Minimap)
  mmCtx.save();
  mmCtx.translate(w / 2, h / 2);
  mmCtx.fillStyle = player.nvgOn ? 'rgba(74, 222, 128, 0.22)' : 'rgba(250, 204, 21, 0.16)';
  mmCtx.beginPath();
  mmCtx.moveTo(0, 0);
  const coneHalfRad = ((camera.fov || 60) * 0.5 * Math.PI) / 180;
  mmCtx.arc(0, 0, 44, -Math.PI / 2 - coneHalfRad, -Math.PI / 2 + coneHalfRad);
  mmCtx.closePath();
  mmCtx.fill();
  mmCtx.restore();

  // Player Arrow at Center
  mmCtx.fillStyle = '#facc15';
  mmCtx.beginPath();
  mmCtx.moveTo(w / 2, h / 2 - 6);
  mmCtx.lineTo(w / 2 - 5, h / 2 + 5);
  mmCtx.lineTo(w / 2 + 5, h / 2 + 5);
  mmCtx.closePath();
  mmCtx.fill();

  const gridLabel = document.getElementById('minimap-grid-label');
  if (gridLabel) {
    const col = player.pos.x > 10 ? 'N' : player.pos.x < -12 ? 'J' : 'K';
    const row = player.pos.z > 8 ? '2' : player.pos.z > -8 ? '3' : '5';
    gridLabel.textContent = `GRID ${col}${row}`;
  }
}

// ---------------------------------------------------------------------------
// Fixed Reference Cameras (concept-to-playable-3d & 8 Port Angles)
// ---------------------------------------------------------------------------
function applyNamedCamera(camKey: string | null) {
  player.fixedCameraKey = camKey;
  const cams = blueprint.cameras as Record<string, { name: string; position: number[]; target: number[]; fov: number }>;
  if (!camKey || !cams[camKey]) {
    player.fixedCameraKey = null;
    fpRig.visible = !loadoutOpen && !missionModalOpen;
    document.getElementById('hud')?.classList.toggle('hidden', loadoutOpen || missionModalOpen);
    camera.fov = 60;
    camera.updateProjectionMatrix();
    return;
  }
  const spec = cams[camKey];
  // Hide HUD in pure reference camera comparison shots ('hero', 'lane') so A/B matches concept art cleanly
  const isConceptRef = camKey === 'hero' || camKey === 'lane';
  fpRig.visible = !isConceptRef;
  document.getElementById('hud')?.classList.toggle('hidden', isConceptRef);

  camera.position.set(spec.position[0], spec.position[1], spec.position[2]);
  camera.fov = spec.fov || 58;
  camera.updateProjectionMatrix();
  camera.lookAt(spec.target[0], spec.target[1], spec.target[2]);
}

// ---------------------------------------------------------------------------
// Performance Telemetry Tracker (FPS, P95 Frame Time, Draw Calls, Triangles)
// ---------------------------------------------------------------------------
const frameTimesMs: number[] = [];
let lastPerfHudUpdate = 0;
let mainPassDrawCalls = 0;
let mainPassTriangles = 0;

function getPerfSummary() {
  const sorted = [...frameTimesMs].sort((a, b) => a - b);
  const avgMs = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 16.6;
  const p95Ms = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 16.6;
  const gl = renderer.getContext();
  const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuRenderer = dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return {
    avgFps: Number((1000 / Math.max(0.1, avgMs)).toFixed(1)),
    p95FrameTimeMs: Number(p95Ms.toFixed(2)),
    first5SecMaxFrameTimeMs: Number(first5SecTracker.maxFrameTimeMs.toFixed(2)),
    drawCalls: mainPassDrawCalls || renderer.info.render.calls,
    triangles: mainPassTriangles || renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    gpuRenderer: String(gpuRenderer),
    isSoftwareRenderer: /SwiftShader|llvmpipe|Basic Render/i.test(String(gpuRenderer)),
  };
}

// ---------------------------------------------------------------------------
// Main Update & Render Loop
// ---------------------------------------------------------------------------
let lastTime = performance.now();

function stepSimulation(dt: number, elapsedSec: number) {
  // 1. Flickering Fire Barrels, Rising Embers & Night Rain (frozen in ?capture mode per concept-to-playable-3d!)
  const t = captureMode ? 1.5 : elapsedSec;
  fireLights.forEach((fl, i) => {
    fl.intensity = 15.5 + Math.sin(t * 11 + i * 2.1) * 2.6;
  });
  fireShaderMats.forEach((sm, i) => {
    sm.uniforms.uTime.value = t + i * 1.3;
  });
  fireFlames.forEach((fm, i) => {
    const s = 0.94 + Math.sin(t * 14 + i) * 0.1;
    fm.scale.set(s, 0.92 + Math.cos(t * 12 + i) * 0.14, s);
  });
  if (emberParticles && !captureMode) {
    const posAttr = emberParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const barrelCoords = [[-3.2, 25.5], [-4.8, 9.5], [4.5, -1.5], [-8.0, -15.0], [15.0, 11.0]];
    for (let i = 0; i < posAttr.count; i++) {
      arr[i * 3 + 1] += dt * (1.25 + (i % 5) * 0.22);
      arr[i * 3] += Math.sin(t * 4.0 + i) * dt * 0.18;
      if (arr[i * 3 + 1] > 3.8) {
        const [bx, bz] = barrelCoords[i % barrelCoords.length];
        arr[i * 3] = bx + Math.cos(i * 2.4) * 0.15;
        arr[i * 3 + 1] = 0.95;
        arr[i * 3 + 2] = bz + Math.sin(i * 2.4) * 0.15;
      }
    }
    posAttr.needsUpdate = true;
  }
  if (rainLines && !captureMode) {
    rainLines.position.y = -((t * 18) % 4.0);
  }
  if (puddleShaderMat) {
    puddleShaderMat.uniforms.uTime.value = t;
  }
  if (harborSeaWater && harborSeaWater.material) {
    const seaMat = harborSeaWater.material as THREE.ShaderMaterial;
    if (seaMat.uniforms?.time) {
      seaMat.uniforms.time.value = t * 0.65;
    }
  }

  if (loadoutOpen) {
    loadoutWeaponHolder.rotation.y += dt * 0.45;
  }

  // 2. Player Movement, First-Person CC0 Arms & Third-Person Over-the-Shoulder Camera
  if (!player.fixedCameraKey && !loadoutOpen && !missionModalOpen) {
    const joySprint = touchMoveVec.y > 0.85 && Math.abs(touchMoveVec.x) < 0.45;
    player.sprinting = (Boolean(keys['ShiftLeft'] || keys['ShiftRight']) || joySprint) && !player.crouching && !player.ads;
    const speed = player.crouching ? 2.8 : player.sprinting ? 6.4 : 4.3;

    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const move = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp']) move.add(fwd);
    if (keys['KeyS'] || keys['ArrowDown']) move.sub(fwd);
    if (keys['KeyD'] || keys['ArrowRight']) move.add(right);
    if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);
    if (touchMoveVec.lengthSq() > 0.01) {
      move.addScaledVector(fwd, touchMoveVec.y).addScaledVector(right, touchMoveVec.x);
    }

    const isMoving = move.lengthSq() > 0;
    if (isMoving) {
      move.normalize().multiplyScalar(speed * dt);
      const nextPos = player.pos.clone().add(move);
      nextPos.x = Math.max(-28, Math.min(24.5, nextPos.x));
      nextPos.z = Math.max(-32, Math.min(34, nextPos.z));

      // Check AABB colliders only when on ground level (y < 2.4)
      let blocked = false;
      if (player.pos.y < 2.4) {
        const pBox = new THREE.Box3(
          new THREE.Vector3(nextPos.x - 0.38, player.pos.y, nextPos.z - 0.38),
          new THREE.Vector3(nextPos.x + 0.38, player.pos.y + 1.7, nextPos.z + 0.38)
        );
        for (const c of colliders) {
          if (pBox.intersectsBox(c)) {
            blocked = true;
            break;
          }
        }
      }
      if (!blocked) {
        player.pos.x = nextPos.x;
        player.pos.z = nextPos.z;
      }
      player.bobPhase += dt * (player.sprinting ? 13 : 9);
      player.stepTimer -= dt;
      if (player.stepTimer <= 0 && player.grounded) {
        player.stepTimer = player.sprinting ? 0.32 : 0.46;
        const surfUrl =
          player.pos.y > 2.5
            ? 'assets/audio/footstep_metal.wav'
            : 'assets/audio/footstep_concrete.wav';
        audioSys.play2D(surfUrl, 0.35);
      }
    }

    // Gravity & Multi-level Ground Height (Dock vs Catwalk Stairs vs Ship Deck)
    const groundY = getGroundHeightAt(player.pos.x, player.pos.z);
    if (!player.grounded || player.pos.y > groundY + 0.05) {
      player.vel.y -= 16.5 * dt;
      player.pos.y += player.vel.y * dt;
      if (player.pos.y <= groundY) {
        player.pos.y = groundY;
        player.vel.y = 0;
        player.grounded = true;
      }
    } else {
      player.pos.y = groundY;
    }

    // Update Third-Person CC0 65-Bone Player Operator Pose & Locomotion Animation
    if (playerTpsRoot) {
      playerTpsRoot.position.set(player.pos.x, player.pos.y, player.pos.z);
      playerTpsRoot.rotation.y = Math.PI + player.yaw;
      if (!player.grounded) {
        playPlayerTpsClip('Jump_Loop', true);
      } else if (isMoving) {
        if (player.crouching) {
          playPlayerTpsClip('Crouch_Fwd_Loop', true);
        } else if (player.sprinting) {
          playPlayerTpsClip('Sprint_Loop', true);
        } else {
          playPlayerTpsClip('Jog_Fwd_Loop', true);
        }
      } else {
        playPlayerTpsClip(player.crouching ? 'Crouch_Idle_Loop' : 'Idle_Loop', true);
      }
      if (playerTpsMixer) {
        playerTpsMixer.update(dt);
      }
      const reloadPct = player.reloading ? Math.min(1, player.reloadTimer / WEAPONS[activeWeaponIdx].reloadTime) : 0;
      poseCharacterTwoHandRifleIk(
        playerTpsRoot,
        playerTpsWeaponMount || undefined,
        player.pitch + player.recoilPitch,
        player.recoilOffsetZ,
        reloadPct
      );
    }

    const eyeHeight = player.crouching ? 1.15 : 1.72;
    const bobY = Math.sin(player.bobPhase) * (player.ads ? 0.006 : 0.025);
    const bobX = Math.cos(player.bobPhase * 0.5) * (player.ads ? 0.004 : 0.018);
    const shakeX = player.cameraShake > 0.005 ? Math.sin(t * 58) * player.cameraShake * 0.14 : 0;
    const shakeY = player.cameraShake > 0.005 ? Math.cos(t * 67) * player.cameraShake * 0.14 : 0;

    // Smooth Tactical Corner Lean ([Q] Left / [E] Right)
    player.leanAmount += (player.leanTarget - player.leanAmount) * Math.min(1, dt * 11.5);
    const leanOffsetX = right.x * player.leanAmount * 0.38;
    const leanOffsetZ = right.z * player.leanAmount * 0.38;
    const leanRollRad = -player.leanAmount * 0.21;

    // Dynamic Thunderstorm Lightning & Distant Thunder Engine
    updateLightningAndThunder(dt, moonLight);

    if (!operationStarted && !isAutomatedQa) {
      // Live 3D Title Screen Cinematic Orbit along the harbor
      const tTitle = performance.now() * 0.00035;
      camera.position.set(
        -14.5 + Math.sin(tTitle * 0.8) * 4.2,
        5.8 + Math.cos(tTitle * 0.5) * 0.8,
        28.0 - (tTitle * 5.0) % 22.0
      );
      camera.lookAt(-4.5, 2.2, 10.0);
      camera.fov = 65;
      camera.updateProjectionMatrix();
      fpRig.visible = false;
      if (playerTpsRoot) playerTpsRoot.visible = false;
      if (stealthHeli) stealthHeli.group.visible = false;
    } else if (infiltrationDirector && infiltrationDirector.active) {
      infiltrationDirector.update(dt, player.pos);
      fpRig.visible = false;
      if (playerTpsRoot) playerTpsRoot.visible = false;
      if (stealthHeli) {
        stealthHeli.update(
          dt,
          infiltrationDirector.helicopterPos,
          infiltrationDirector.helicopterRotY,
          infiltrationDirector.helicopterPitch,
          infiltrationDirector.cabinLightColor
        );
        stealthHeli.group.visible = true;
      }
    } else if (evacuationDirector && evacuationDirector.active) {
      evacuationDirector.update(dt);
      fpRig.visible = false;
      if (playerTpsRoot) playerTpsRoot.visible = false;
      if (stealthHeli) {
        stealthHeli.update(
          dt,
          evacuationDirector.helicopterPos,
          evacuationDirector.helicopterRotY,
          evacuationDirector.helicopterPitch,
          new THREE.Color('#22c55e')
        );
        stealthHeli.group.visible = true;
      }
    } else if (player.thirdPerson) {
      if (stealthHeli) stealthHeli.group.visible = false;
      if (playerTpsRoot) playerTpsRoot.visible = !loadoutOpen && !missionModalOpen;
      fpRig.visible = false;
      // Over-the-Shoulder Third-Person Tactical Camera
      const camBack = player.ads ? 1.38 : 2.38;
      const camRight = (player.ads ? 0.44 : 0.56) + player.leanAmount * 0.38;
      const camUp = eyeHeight + (player.crouching ? 0.22 : 0.18);
      camera.position.set(
        player.pos.x + right.x * camRight - fwd.x * camBack + shakeX,
        player.pos.y + camUp + bobY * 0.5 + shakeY,
        player.pos.z + right.z * camRight - fwd.z * camBack
      );
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch + player.recoilPitch + shakeY * 0.35 - 0.04;
      camera.rotation.z = leanRollRad * 0.6;
    } else {
      // First-Person Mode: NEVER RENDER 3RD PERSON HEAD/BODY MODEL!
      if (stealthHeli) stealthHeli.group.visible = false;
      if (playerTpsRoot) playerTpsRoot.visible = false;
      fpRig.visible = !loadoutOpen && !missionModalOpen;
      camera.position.set(
        player.pos.x + bobX + shakeX + leanOffsetX,
        player.pos.y + eyeHeight + bobY + shakeY - Math.abs(player.leanAmount) * 0.06,
        player.pos.z + leanOffsetZ
      );
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch + player.recoilPitch + shakeY * 0.35;
      camera.rotation.z = leanRollRad;
    }

    // Hot Extraction Helipad Trigger (Goal B - Stage 5)
    if (player.gameMode === 'RAID' && player.raidStage === 5 && !evacuationDirector.active && !missionModalOpen) {
      const evacDist = player.pos.distanceTo(new THREE.Vector3(-18, 0.2, 38));
      if (evacDist <= 4.2) {
        launchHotEvacuation();
      }
    }

    // Smooth ADS FOV & Viewmodel Position (+ Melee Buttstock Lunge)
    const w = WEAPONS[activeWeaponIdx];
    const targetFov = player.ads ? w.adsFov : 60;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();

    let meleeLungeZ = 0;
    let meleePitch = 0;
    if (player.meleeTimer > 0) {
      player.meleeTimer = Math.max(0, player.meleeTimer - dt);
      const mPhase = Math.sin((player.meleeTimer / 0.36) * Math.PI);
      meleeLungeZ = -0.18 * mPhase;
      meleePitch = 0.32 * mPhase;
    }

    const targetRigX = player.ads ? 0.0 : 0.22;
    const targetRigY = player.ads ? -0.145 : -0.24;
    const targetRigZ = (player.ads ? -0.28 : -0.38) + player.recoilOffsetZ + meleeLungeZ;
    fpRig.position.x += (targetRigX - fpRig.position.x) * Math.min(1, dt * 16);
    fpRig.position.y += (targetRigY - fpRig.position.y) * Math.min(1, dt * 16);
    fpRig.position.z += (targetRigZ - fpRig.position.z) * Math.min(1, dt * 16);

    // Reload Animation & Progress
    if (player.reloading) {
      player.reloadTimer += dt;
      const pct = Math.min(1, player.reloadTimer / w.reloadTime);
      const fillEl = document.getElementById('reload-bar-fill');
      if (fillEl) fillEl.style.width = `${pct * 100}%`;
      weaponMount.rotation.x = -Math.sin(pct * Math.PI) * 0.55;
      weaponMount.rotation.z = Math.sin(pct * Math.PI) * 0.35;
      if (pct >= 1) {
        const needed = w.magSize - w.mag;
        const take = Math.min(needed, w.reserve);
        w.mag += take;
        w.reserve -= take;
        player.reloading = false;
        weaponMount.rotation.set(0, 0, 0);
        document.getElementById('reload-box')?.classList.add('hidden');
        updateWeaponHud();
      }
    } else if (player.inspectTimer > 0) {
      player.inspectTimer = Math.max(0, player.inspectTimer - dt);
      const iPct = 1 - player.inspectTimer / 2.2;
      const tiltWave = Math.sin(iPct * Math.PI * 2);
      const liftWave = Math.sin(iPct * Math.PI);
      weaponMount.rotation.x = 0.22 * liftWave;
      weaponMount.rotation.y = 0.52 * tiltWave;
      weaponMount.rotation.z = 0.38 * tiltWave;
      if (player.inspectTimer <= 0) {
        weaponMount.rotation.set(0, 0, 0);
      }
    } else {
      weaponMount.rotation.x = weaponMount.rotation.x * 0.85 + meleePitch * 0.25;
      weaponMount.rotation.y *= 0.85;
      weaponMount.rotation.z *= 0.85;
    }

    // Solve Two-Handed Rifle IK for First-Person CC0 Arms against active weapon grip & foregrip
    updateFirstPersonCc0HandsIk();

    // Dynamic Reticle Spread Expansion based on Movement, ADS & Weapon Recoil
    const retWrap = document.getElementById('reticle-wrap');
    if (retWrap) {
      const spreadScale = player.ads ? 0.72 : 1.0 + (isMoving ? 0.22 : 0) + player.recoilOffsetZ * 3.2;
      retWrap.style.transform = `translate(-50%, -50%) scale(${spreadScale.toFixed(2)})`;
    }

    // North Harbor Master Control Terminal Objective Interaction at (-4.0, 0, -18.0)
    const distToTerminal = Math.hypot(player.pos.x - -4.0, player.pos.z - -18.0);
    const termBox = document.getElementById('terminal-box');
    const termFill = document.getElementById('terminal-bar-fill');
    const termTitle = document.getElementById('terminal-title');
    if (distToTerminal <= 4.2 && !player.terminalHacked) {
      termBox?.classList.remove('hidden');
      if (keys['KeyE'] || distToTerminal <= 2.6) {
        player.terminalHackProgress = Math.min(1.0, player.terminalHackProgress + dt * 0.55);
        if (termFill) termFill.style.width = `${(player.terminalHackProgress * 100).toFixed(0)}%`;
        if (termTitle) termTitle.textContent = `⚡ 正在駭入奪還港務主控終端... ${Math.round(player.terminalHackProgress * 100)}%`;
        if (player.terminalHackProgress >= 1.0) {
          player.terminalHacked = true;
          audioSys.play2D('assets/audio/fire_mode_click.wav', 0.95);
          showKillBanner('TERMINAL SECURED +250');
          updateObjectiveHud();
          if (!narrativeState.terminalHacked) {
            narrativeState.terminalHacked = true;
            tacticalRadioAudio.speakRadioLine('COMMAND', 'Terminal data secured! Pelican is inbound for extraction!');
            screensMgr.showInGameRadio('[COMMAND]', '"Terminal data secured! Pelican is inbound for extraction!"', 5.0);
          }
          setTimeout(() => termBox?.classList.add('hidden'), 1400);
        }
      } else {
        if (termTitle) termTitle.textContent = '⚡ [E] 按住駭入奪還港務主控終端 // HOLD [E] TO HACK';
      }
    } else if (!player.terminalHacked) {
      termBox?.classList.add('hidden');
    }

    // Auto-fire for AR-7 / SMG-9, 3-Round Burst Queue & Mobile Reticle Auto-Fire Assist
    if (player.burstRemaining > 0) {
      player.burstTimer -= dt;
      if (player.burstTimer <= 0) {
        player.burstRemaining--;
        player.burstTimer = w.fireInterval * 0.82;
        fireSingleRound(true);
      }
    } else if (mouseDownLeft && w.fireMode === 'AUTO') {
      fireCurrentWeapon();
    } else if (player.autoFireOn && !player.reloading && player.fireTimer <= 0 && w.fireMode !== 'ROCKET') {
      // Check if center reticle is aligned with any alive enemy within 32m!
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      for (const e of enemies) {
        if (e.state === 'DEAD') continue;
        const chestPos = e.root.position.clone().add(new THREE.Vector3(0, 1.25, 0));
        const toE = chestPos.sub(camera.position);
        const distE = toE.length();
        if (distE <= 32 && toE.normalize().dot(camDir) >= 0.993) {
          fireCurrentWeapon();
          break;
        }
      }
    }

    // Update Sniper Rangefinder & Compass Heading
    const headingDeg = (((-player.yaw * 180) / Math.PI) % 360 + 360) % 360;
    const compEl = document.getElementById('compass-heading');
    if (compEl) compEl.textContent = String(Math.round(headingDeg)).padStart(3, '0');
    const objDistEl = document.getElementById('objective-dist');
    if (objDistEl) {
      const d = Math.round(Math.hypot(player.pos.x - -4.0, player.pos.z - -18.0));
      objDistEl.textContent = `${d}m`;
    }
    if (player.ads && w.id === 'sr9') {
      const rangeEl = document.getElementById('scope-range-val');
      if (rangeEl) {
        const nearest = enemies
          .filter((e) => e.state !== 'DEAD')
          .map((e) => e.root.position.distanceTo(player.pos))
          .sort((a, b) => a - b)[0];
        rangeEl.textContent = `${Math.round(nearest || 47)} m`;
      }
    }
  }

  // Decay weapon recoil, camera shake & muzzle flash
  player.fireTimer = Math.max(0, player.fireTimer - dt);
  player.recoilOffsetZ *= Math.pow(0.08, dt);
  player.recoilPitch *= Math.pow(0.08, dt);
  player.cameraShake = Math.max(0, player.cameraShake - dt * 2.1);
  if (muzzleFlashMesh.material.opacity > 0) {
    muzzleFlashMesh.material.opacity = Math.max(0, muzzleFlashMesh.material.opacity - dt * 16);
  }
  if (muzzleLight.intensity > 0) {
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 220);
    if (muzzleLight.intensity <= 0) muzzleLight.visible = false;
  }
  if (player.multiKillTimer > 0) {
    player.multiKillTimer -= dt;
    if (player.multiKillTimer <= 0) player.multiKillCount = 0;
  }

  // Update Ejected Brass Shell Casings & Ballistic Tracers
  for (let i = activeShells.length - 1; i >= 0; i--) {
    const sh = activeShells[i];
    sh.age += dt;
    if (sh.age > 0.75) {
      scene.remove(sh.mesh);
      activeShells.splice(i, 1);
      continue;
    }
    sh.vel.y -= 13.5 * dt;
    sh.mesh.position.addScaledVector(sh.vel, dt);
    sh.mesh.rotation.x += sh.rotVel.x * dt;
    sh.mesh.rotation.y += sh.rotVel.y * dt;
    sh.mesh.rotation.z += sh.rotVel.z * dt;
    if (sh.mesh.position.y < 0.02) {
      sh.mesh.position.y = 0.02;
      sh.vel.y = Math.abs(sh.vel.y) * 0.45;
      sh.vel.x *= 0.6;
      sh.vel.z *= 0.6;
    }
  }

  for (let i = activeTracers.length - 1; i >= 0; i--) {
    const tr = activeTracers[i];
    tr.age += dt;
    if (tr.age > 0.085) {
      scene.remove(tr.line);
      tr.line.geometry.dispose();
      activeTracers.splice(i, 1);
      continue;
    }
    (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 0.88 * (1 - tr.age / 0.085));
  }

  // 3. Active Rockets & Exhaust Smoke Trail Update
  const smokeGeo = new THREE.SphereGeometry(0.18, 8, 6);
  for (let i = activeRockets.length - 1; i >= 0; i--) {
    const r = activeRockets[i];
    r.age += dt;
    r.smokeTimer += dt;
    r.mesh.position.addScaledVector(r.velocity, dt);
    if (r.smokeTimer >= 0.022) {
      r.smokeTimer = 0;
      const puffMat = new THREE.MeshBasicMaterial({
        color: 0x64686e,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      });
      const puff = new THREE.Mesh(smokeGeo, puffMat);
      puff.position.copy(r.mesh.position);
      scene.add(puff);
      activeSmokePuffs.push({ mesh: puff, age: 0, maxAge: 0.55 });
    }
    const hitGround = r.mesh.position.y <= 0.25;
    const hitEnemy = enemies.some(
      (e) => e.state !== 'DEAD' && e.root.position.distanceTo(r.mesh.position) < 1.8
    );
    if (hitGround || hitEnemy || r.age > 3.0) {
      triggerExplosionAt(r.mesh.position.clone(), 8.5, 190);
      scene.remove(r.mesh);
      activeRockets.splice(i, 1);
    }
  }

  // 3b. Active Thrown Frag Grenades ([G]) Parabolic Flight, Bounce & Fuse Detonation
  for (let i = activeGrenades.length - 1; i >= 0; i--) {
    const gr = activeGrenades[i];
    gr.age += dt;
    gr.vel.y -= 16.5 * dt;
    gr.mesh.position.addScaledVector(gr.vel, dt);
    gr.mesh.rotation.x += dt * 9.0;
    gr.mesh.rotation.z += dt * 7.0;

    const gFloor = getGroundHeightAt(gr.mesh.position.x, gr.mesh.position.z) + 0.08;
    if (gr.mesh.position.y <= gFloor) {
      gr.mesh.position.y = gFloor;
      if (Math.abs(gr.vel.y) > 1.2) {
        audioSys.play3D('assets/audio/grenade_bounce.wav', gr.mesh.position, player.pos, 6, 40, 0.85);
      }
      gr.vel.y = Math.abs(gr.vel.y) * 0.44;
      gr.vel.x *= 0.62;
      gr.vel.z *= 0.62;
      gr.bounced = true;
    }

    if (gr.age >= gr.fuseTime) {
      triggerExplosionAt(gr.mesh.position.clone(), 8.2, 180);
      scene.remove(gr.mesh);
      activeGrenades.splice(i, 1);
    }
  }

  for (let i = activeSmokePuffs.length - 1; i >= 0; i--) {
    const sp = activeSmokePuffs[i];
    sp.age += dt;
    const p = sp.age / sp.maxAge;
    if (p >= 1) {
      scene.remove(sp.mesh);
      activeSmokePuffs.splice(i, 1);
      continue;
    }
    sp.mesh.scale.setScalar(1 + p * 3.6);
    if (sp.mesh.position.y > 0) sp.mesh.position.y += dt * 0.9;
    (sp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.52 * (1 - p));
  }

  // 3c. Lootable Tactical Supply Drops (Auto-collect when player walks within 2.2m!)
  for (let i = activeLootDrops.length - 1; i >= 0; i--) {
    const ld = activeLootDrops[i];
    if (ld.collected) continue;
    ld.age += dt;
    ld.mesh.rotation.y += dt * 2.2;
    ld.mesh.position.y = ld.position.y + Math.sin(ld.age * 4.5) * 0.06;
    if (player.pos.distanceTo(ld.position) <= 2.25) {
      ld.collected = true;
      scene.remove(ld.mesh);
      activeLootDrops.splice(i, 1);
      player.armor = Math.min(player.maxArmor, player.armor + 25);
      WEAPONS[activeWeaponIdx].reserve += WEAPONS[activeWeaponIdx].magSize;
      audioSys.play2D('assets/audio/fire_mode_click.wav', 0.85);
      showKillBanner('RESUPPLY +25 ARMOR & AMMO');
      updateStatusHud();
      updateWeaponHud();
    }
  }

  // 3d. Interactive Suspended Crane Container Falling Physics & Impact Crush
  if (suspendedCargo && suspendedCargo.state === 'FALLING') {
    suspendedCargo.velY -= 22.0 * dt;
    suspendedCargo.group.position.y += suspendedCargo.velY * dt;
    if (suspendedCargo.group.position.y <= 0) {
      suspendedCargo.group.position.y = 0;
      suspendedCargo.velY = 0;
      suspendedCargo.state = 'LANDED';
      player.cameraShake = Math.max(player.cameraShake, 0.72);
      audioSys.play3D('assets/audio/rl7_explosion.wav', suspendedCargo.group.position, player.pos, 10, 85, 1.1);
      // Register new permanent cover AABB collider where the container landed
      colliders.push(
        new THREE.Box3(
          new THREE.Vector3(suspendedCargo.group.position.x - 1.28, 0, suspendedCargo.group.position.z - 3.05),
          new THREE.Vector3(suspendedCargo.group.position.x + 1.28, 2.65, suspendedCargo.group.position.z + 3.05)
        )
      );
      // Crush or blast any enemy underneath the falling 20ft container
      for (const e of enemies) {
        if (e.state === 'DEAD') continue;
        const d = e.root.position.distanceTo(suspendedCargo.group.position);
        if (d <= 5.5) {
          damageEnemy(e, 220, false, 'CRANE DROP');
        }
      }
    }
  }

  // 3e. Dynamic Night Storm Lightning Flash (Live gameplay only; deterministic in ?capture mode!)
  if (!captureMode) {
    const stormPhase = elapsedSec % 21.0;
    const isFlash = (stormPhase > 19.2 && stormPhase < 19.32) || (stormPhase > 19.42 && stormPhase < 19.48);
    renderer.toneMappingExposure = player.nvgOn ? 2.05 : isFlash ? 2.15 : 1.42;
  } else {
    renderer.toneMappingExposure = player.nvgOn ? 2.05 : 1.42;
  }

  // 4. Active Explosions Update (Multi-Stage Fireball + Blast Light + Ballistic Shrapnel -> Plume -> Shockwave)
  for (let i = activeExplosions.length - 1; i >= 0; i--) {
    const ex = activeExplosions[i];
    ex.age += dt;
    const p = ex.age / ex.duration;
    if (p >= 1) {
      scene.remove(ex.group);
      activeExplosions.splice(i, 1);
      continue;
    }
    ex.innerCore.scale.setScalar(1 + p * 2.2);
    (ex.innerCore.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p * 2.0);
    ex.core.scale.setScalar(1 + p * 2.6);
    (ex.core.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.96 * (1 - p * 1.35));
    ex.plume.scale.setScalar(1 + p * 2.4);
    ex.plume.position.y = 2.35 + p * 3.6;
    (ex.plume.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.72 * (1 - p));
    ex.secondaryPlume.scale.setScalar(1 + p * 2.5);
    ex.secondaryPlume.position.y = 1.55 + p * 2.8;
    (ex.secondaryPlume.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.90 * (1 - p * 1.3));
    ex.shockwave.scale.setScalar(1 + p * 5.2);
    (ex.shockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - p * 1.35));
    ex.blastLight.intensity = Math.max(0, 110 * Math.pow(1 - p, 2.0));

    for (const d of ex.debris) {
      d.vel.y -= 14.5 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rotSpeed.x * dt;
      d.mesh.rotation.y += d.rotSpeed.y * dt;
      if (d.mesh.position.y < 0.08) {
        d.mesh.position.y = 0.08;
        d.vel.y = Math.abs(d.vel.y) * 0.42;
        d.vel.x *= 0.65;
        d.vel.z *= 0.65;
      }
      (d.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - p * 1.1);
    }
  }

  // 5. Update Enemy Tactical Soldiers & CC0 Skeletal Animations (with Distance LOD Throttling & Cover AI!)
  if (!captureMode) {
    for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
      const e = enemies[eIdx];
      // Foot Lock / Ground Clamp
      e.root.position.y = e.baseY;
      if ((e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity > 0) {
        (e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          (e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity - dt * 12
        );
      }
      if (e.state === 'DEAD') {
        e.mixer.update(dt);
        continue;
      }

      const toPlayer = new THREE.Vector3(
        player.pos.x - e.root.position.x,
        0,
        player.pos.z - e.root.position.z
      );
      const dist = toPlayer.length();

      // Juggernaut Boss Stagger & Screen Shake (Goal B)
      if (e.archetype === 'JUGGERNAUT') {
        if (e.isStaggered) {
          e.staggerTimer = (e.staggerTimer || 0) - dt;
          if (e.staggerTimer <= 0) {
            e.isStaggered = false;
            if (e.shieldGroup) e.shieldGroup.rotation.y = 0.22;
            const shieldInd = document.getElementById('boss-shield-indicator');
            if (shieldInd) {
              shieldInd.textContent = '🛡️ 防彈重盾: 啟用中 (減傷80%)';
              shieldInd.style.color = '#38bdf8';
            }
          }
        }
        if (dist < 15.0) {
          player.cameraShake = Math.max(player.cameraShake, 0.08 * (1 - dist / 15.0));
        }
      }

      // Update Elite Sniper Visible Red Laser Sight Beam (sweeps forward on patrol; locks onto player ONLY when alert/in combat!)
      if (e.laserLine && reflectionFrameTick % 2 === 0) {
        const posAttr = e.laserLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (posAttr) {
          posAttr.setXYZ(0, e.root.position.x, e.root.position.y + 1.42, e.root.position.z);
          if (e.state === 'COMBAT') {
            posAttr.setXYZ(1, player.pos.x, player.pos.y + 1.15, player.pos.z);
          } else {
            const fx = Math.sin(e.root.rotation.y) * 18.0;
            const fz = Math.cos(e.root.rotation.y) * 18.0;
            posAttr.setXYZ(1, e.root.position.x + fx, e.root.position.y + 1.25, e.root.position.z + fz);
          }
          posAttr.needsUpdate = true;
        }
      }

      // Update 3D Overhead Tactical Status Badge & HP Bar Billboard Orientation
      if (e.statusSprite) {
        e.statusSprite.material =
          e.state === 'COVER' ? statusMatCover : e.state === 'PATROL' ? statusMatPatrol : statusMatCombat;
      }
      if (e.hpBarGroup && e.hpBarGroup.visible) {
        e.hpBarGroup.lookAt(camera.position);
      }

      // Distance LOD throttling: update full skeletal mixer + 2-Bone IK at 1/2 rate when enemy is > 28m away
      const lodSkip = dist > 28 && (reflectionFrameTick + eIdx) % 2 !== 0;
      if (!lodSkip) {
        e.mixer.update(dist > 28 ? dt * 2 : dt);
      }

      if (e.state === 'HIT') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          // Enter tactical crouch-cover if damaged below 65 HP!
          e.state = e.hp <= 65 ? 'COVER' : 'COMBAT';
          e.stateTimer = e.state === 'COVER' ? 2.4 : 0;
          playEnemyClip(e, e.state === 'COVER' ? 'Crouch_Idle_Loop' : 'Idle_Loop', true);
        }
        if (!lodSkip) {
          poseCharacterTwoHandRifleIk(e.root, undefined, e.baseY > 2.5 ? -0.22 : 0.0, 0, 0);
        }
        continue;
      }

      if (e.state === 'PATROL') {
        const targetPt = e.patrolPoints[e.patrolIdx];
        const dx = targetPt[0] - e.root.position.x;
        const dz = targetPt[1] - e.root.position.z;
        const dPt = Math.hypot(dx, dz);
        if (dPt < 0.35) {
          e.patrolIdx = (e.patrolIdx + 1) % e.patrolPoints.length;
        } else {
          e.root.position.x += (dx / dPt) * 1.65 * dt;
          e.root.position.z += (dz / dPt) * 1.65 * dt;
          e.root.rotation.y = Math.atan2(dx, dz);
          playEnemyClip(e, 'Walk_Loop', true);
        }
        if (!lodSkip) {
          poseCharacterTwoHandRifleIk(e.root, undefined, -0.06, 0, 0);
        }
        // Realistic enemy line-of-sight & proximity detection:
        // 1. If player is in covered LZ staging zone (player.pos.z > 20.0), heavy shipping containers completely block line of sight
        // 2. Vision cone: enemy must face player (dotSight > 0.52, ~60 deg cone) and dist < 18m
        // 3. Proximity footstep sound alert: dist < 4.0m (or 2.5m if crouching)
        const inStagingArea = player.pos.z > 20.0;
        if (!inStagingArea) {
          const enemyFacing = new THREE.Vector3(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y));
          const toPlayerNorm = toPlayer.clone().normalize();
          const dotSight = enemyFacing.dot(toPlayerNorm);
          const hasVisual = dotSight > 0.52 && dist < (player.crouching ? 11.0 : 18.0);
          const hasCloseProximity = dist < (player.crouching ? 2.5 : 4.0);

          if (hasVisual || hasCloseProximity) {
            e.state = 'COMBAT';
            e.fireCooldown = 0.9 + Math.random() * 0.5; // Reaction pause before opening fire!
            audioSys.play2D('assets/audio/fire_mode_click.wav', 0.6);
            showKillBanner(`ALERT: ${e.name.split(' ')[0]} SPOTTED TARGET!`);
          }
        }
      } else if (e.state === 'COMBAT' || e.state === 'COVER') {
        e.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        if (e.state === 'COVER') {
          e.stateTimer -= dt;
          playEnemyClip(e, 'Crouch_Idle_Loop', true);
          if (e.stateTimer <= 0) {
            e.state = 'COMBAT';
          }
        } else {
          playEnemyClip(e, 'Idle_Loop', true);
        }
        if (!lodSkip) {
          poseCharacterTwoHandRifleIk(e.root, undefined, e.baseY > 2.5 ? -0.22 : 0.0, 0, 0);
        }
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 34) {
          e.fireCooldown = e.archetype === 'JUGGERNAUT' ? 0.35 : 1.45 + Math.random() * 0.8;
          (e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0.95;
          audioSys.play3D('assets/audio/ar7_shot.wav', e.root.position, player.pos, 5, 45, e.archetype === 'JUGGERNAUT' ? 0.85 : 0.55);

          // Spawn visible orange-red enemy outgoing tracer streak
          const enemyMuzzle = new THREE.Vector3();
          e.muzzleFlash.getWorldPosition(enemyMuzzle);
          const tracerEnd = new THREE.Vector3(
            player.pos.x + (Math.random() - 0.5) * 0.65,
            player.pos.y + 1.25 + (Math.random() - 0.5) * 0.35,
            player.pos.z + (Math.random() - 0.5) * 0.65
          );
          const eTracerGeo = new THREE.BufferGeometry().setFromPoints([enemyMuzzle, tracerEnd]);
          const eTracerMat = new THREE.LineBasicMaterial({
            color: 0xff5522,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
          });
          const eLine = new THREE.Line(eTracerGeo, eTracerMat);
          scene.add(eLine);
          activeTracers.push({ line: eLine, age: 0 });

          // Inflict slight damage to player if in line of sight
          if (dist < 26 && !player.fixedCameraKey) {
            const dmg = 4;
            if (player.armor > 0) {
              player.armor = Math.max(0, player.armor - dmg);
            } else {
              player.hp = Math.max(15, player.hp - dmg);
            }
            player.damageTaken += dmg;
            updateStatusHud();
            showDirectionalDamageArc(e.root.position);
            const vig = document.getElementById('damage-vignette');
            if (vig) {
              vig.style.boxShadow = 'inset 0 0 110px rgba(220, 25, 20, 0.55)';
              setTimeout(() => {
                vig.style.boxShadow = 'inset 0 0 110px rgba(220, 25, 20, 0)';
              }, 160);
            }
          }
        }
      }
    }
  }

  // Update Allied Squad Tactical Behaviors & World Dynamic Rain/Storm
  if (squadMgr) {
    squadMgr.update(dt, player.pos, enemies);
  }
  if (worldDetails) {
    worldDetails.update(dt, elapsedSec, renderer);
  }

  renderMinimap();
}

function renderSceneWithWater(forceReflection = true) {
  // Picture-in-Picture 4x Scope Lens Render Pass
  if (player.ads && WEAPONS[activeWeaponIdx].id === 'sr9' && pipScope) {
    pipScope.render(renderer, scene, camera);
  }

  const prevAutoReset = renderer.info.autoReset;
  renderer.info.autoReset = false;

  if (forceReflection) {
    renderer.shadowMap.needsUpdate = true;
    updateGroundPlanarReflection();
  } else {
    reflectionFrameTick++;
    if (reflectionFrameTick % 4 === 0) renderer.shadowMap.needsUpdate = true;
    if (reflectionFrameTick % 2 === 0) updateGroundPlanarReflection();
  }

  // Note: Water.js runs an internal mirror render inside onBeforeRender which calls renderer.render() and resets renderer.info.
  // To avoid running a redundant full-scene mirror pass on every frame AND measure exact main-camera Draw Calls,
  // we allow Water.js mirror pass once every 4 frames (before resetting info), then render the main camera pass cleanly!
  const prevSeaBeforeRender = harborSeaWater ? harborSeaWater.onBeforeRender : null;
  if (harborSeaWater) {
    if (forceReflection || reflectionFrameTick % 4 === 0) {
      // Trigger sea mirror render now so it doesn't run inside the main camera pass
      harborSeaWater.onBeforeRender(renderer, scene, camera, harborSeaWater.geometry, harborSeaWater.material as THREE.Material, null as unknown as THREE.Group);
    }
    harborSeaWater.onBeforeRender = () => {};
  }

  renderer.info.reset();
  renderer.render(scene, camera);
  if (harborSeaWater && prevSeaBeforeRender) {
    harborSeaWater.onBeforeRender = prevSeaBeforeRender;
  }
  mainPassDrawCalls = renderer.info.render.calls;
  mainPassTriangles = renderer.info.render.triangles;
  renderer.info.autoReset = prevAutoReset;
}

function animate(now: number) {
  requestAnimationFrame(animate);
  const rawDt = now - lastTime;
  lastTime = now;
  if (rawDt > 0 && rawDt < 500) {
    frameTimesMs.push(rawDt);
    if (frameTimesMs.length > 180) frameTimesMs.shift();

    // 5-Second Warmup Frame Time Gate Tracker (< 50ms)
    if (first5SecTracker.active) {
      const elapsed = now - first5SecTracker.startTime;
      if (rawDt > first5SecTracker.maxFrameTimeMs) {
        first5SecTracker.maxFrameTimeMs = rawDt;
      }
      first5SecTracker.recordedFrames++;
      if (elapsed >= 5000) {
        first5SecTracker.active = false;
        console.log(`[PERF GATE] First 5-sec max frame time: ${first5SecTracker.maxFrameTimeMs.toFixed(2)}ms (Target < 50ms)`);
      }
    }
  }
  const dt = Math.min(0.05, rawDt / 1000);
  stepSimulation(dt, now / 1000);
  renderSceneWithWater(false);

  if (now - lastPerfHudUpdate > 400) {
    lastPerfHudUpdate = now;
    const p = getPerfSummary();
    const badge = document.getElementById('perf-badge');
    if (badge) {
      badge.textContent = `FPS: ${p.avgFps} | P95: ${p.p95FrameTimeMs}ms | DC: ${p.drawCalls} | Tris: ${p.triangles}`;
    }
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Deterministic QA & Automation API (window.__fpsApi)
// ---------------------------------------------------------------------------
(window as unknown as Record<string, unknown>).__fpsApi = {
  setCamera: (camKey: string | null) => {
    applyNamedCamera(camKey);
    renderSceneWithWater();
  },
  setPlayerPose: (x: number, y: number, z: number, yaw: number, pitch = 0) => {
    player.fixedCameraKey = null;
    fpRig.visible = !player.thirdPerson && !loadoutOpen && !missionModalOpen;
    if (playerTpsRoot) playerTpsRoot.visible = player.thirdPerson && !loadoutOpen && !missionModalOpen;
    document.getElementById('hud')?.classList.remove('hidden');
    player.pos.set(x, y, z);
    player.yaw = yaw;
    player.pitch = pitch;
    stepSimulation(0.016, 1.5);
    renderSceneWithWater();
  },
  setThirdPerson: (tp: boolean) => {
    setThirdPersonMode(tp);
    stepSimulation(0.04, 1.5);
    renderSceneWithWater();
  },
  equipWeapon: (idx: number) => {
    equipWeapon(idx);
    updateFirstPersonCc0HandsIk();
    renderSceneWithWater();
  },
  setAds: (ads: boolean) => {
    setAdsState(ads);
    stepSimulation(0.08, 1.5);
    renderSceneWithWater();
  },
  fire: () => {
    player.fireTimer = 0;
    fireCurrentWeapon();
    stepSimulation(0.016, 1.5);
    renderSceneWithWater();
  },
  detonateAt: (x: number, y: number, z: number, advanceSec = 0.18) => {
    triggerExplosionAt(new THREE.Vector3(x, y, z), 8.5, 190);
    stepSimulation(advanceSec, 1.5);
    renderSceneWithWater();
  },
  throwGrenade: (advanceSec = 0.45) => {
    throwFragGrenade();
    stepSimulation(advanceSec, 1.5);
    renderSceneWithWater();
  },
  setLean: (leanVal: number) => {
    player.leanTarget = leanVal;
    player.leanAmount = leanVal;
    updateStatusHud();
    stepSimulation(0.05, 1.5);
    renderSceneWithWater();
  },
  cycleFireMode: () => {
    cycleFireMode();
    renderSceneWithWater();
  },
  setGyroState: (enabled: boolean, yawDeltaRad = 0, pitchDeltaRad = 0) => {
    gyroController.enabled = enabled;
    updateGyroHudButtons();
    if (enabled && (yawDeltaRad !== 0 || pitchDeltaRad !== 0)) {
      const [adjYaw, adjPitch] = applyGyroAimAssistToDelta(yawDeltaRad, pitchDeltaRad);
      player.yaw += adjYaw;
      player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch + adjPitch));
    }
    stepSimulation(0.032, 1.5);
    renderSceneWithWater();
  },
  hackTerminal: () => {
    player.terminalHackProgress = 1.0;
    player.terminalHacked = true;
    updateObjectiveHud();
    showKillBanner('TERMINAL SECURED +250');
    renderSceneWithWater();
  },
  reload: () => {
    const w = WEAPONS[activeWeaponIdx];
    w.mag = Math.max(1, w.mag - 5);
    startReload();
    stepSimulation(0.35, 1.5);
    renderSceneWithWater();
  },
  toggleFlashlight: (on?: boolean) => {
    player.flashlightOn = on !== undefined ? on : !player.flashlightOn;
    if (player.flashlightOn) {
      weaponMount.add(tacticalFlashlight);
    } else {
      weaponMount.remove(tacticalFlashlight);
    }
    tacticalFlashlight.visible = player.flashlightOn;
    tacticalFlashlight.intensity = player.flashlightOn ? 28 : 0;
    smgLaserBeam.visible = player.flashlightOn || Boolean(WEAPONS[activeWeaponIdx].hasGreenLaser);
    updateWeaponHud();
    renderSceneWithWater();
  },
  useStim: () => {
    useCombatMedStim();
    renderSceneWithWater();
  },
  toggleNvg: (on?: boolean) => {
    toggleNvgMode(on);
    renderSceneWithWater();
  },
  inspectWeapon: (advanceSec = 0.55) => {
    triggerWeaponInspect();
    stepSimulation(advanceSec, 1.5);
    renderSceneWithWater();
  },
  dropCraneCargo: () => {
    releaseSuspendedCargoContainer();
    stepSimulation(0.45, 1.5);
    stepSimulation(0.45, 1.95);
    renderSceneWithWater();
  },
  swipeLook: (dxPx: number, dyPx: number) => {
    applyTouchLookDelta(dxPx, dyPx);
    stepSimulation(0.016, 1.5);
    renderSceneWithWater();
  },
  toggleAutoFire: (on?: boolean) => {
    toggleAutoFireAssist(on);
    renderSceneWithWater();
  },
  toggleDrawer: (open?: boolean) => {
    toggleTacticalDrawer(open);
    renderSceneWithWater();
  },
  toggleLoadout: (open: boolean) => {
    toggleLoadoutModal(open);
    renderSceneWithWater();
  },
  openMissionComplete: () => {
    openMissionCompleteModal();
    renderSceneWithWater();
  },
  closeModals: () => {
    toggleLoadoutModal(false);
    missionModalOpen = false;
    document.getElementById('mission-modal')?.classList.add('hidden');
    document.getElementById('screen-title-portal')?.classList.add('hidden');
    document.getElementById('screen-preload')?.classList.add('hidden');
    document.getElementById('screen-pause')?.classList.add('hidden');
    document.getElementById('screen-records')?.classList.add('hidden');
    document.getElementById('hud')?.classList.remove('hidden');
    fpRig.visible = true;
    renderSceneWithWater();
  },
  resetPerf: () => {
    frameTimesMs.length = 0;
    lastTime = performance.now();
  },
  getPerf: () => getPerfSummary(),
  getState: () => ({
    playerPos: player.pos.toArray(),
    yaw: player.yaw,
    pitch: player.pitch,
    hp: player.hp,
    armor: player.armor,
    activeWeapon: WEAPONS[activeWeaponIdx].name,
    fireMode: WEAPONS[activeWeaponIdx].fireMode,
    mag: WEAPONS[activeWeaponIdx].mag,
    grenades: player.grenades,
    leanAmount: player.leanAmount,
    gyroEnabled: gyroController.enabled,
    terminalHacked: player.terminalHacked,
    enemiesAlive: enemies.filter((e) => e.state !== 'DEAD').length,
    enemiesTotal: enemies.length,
    kills: player.kills,
    bossSpawned,
    bossDefeated,
    raidStage: player.raidStage,
  }),
  triggerBossPhase: () => {
    triggerBossPhase();
    stepSimulation(0.05, 1.5);
    renderSceneWithWater();
  },
  damageBoss: (amount: number, isExplosive = false) => {
    if (bossActorRef) {
      damageEnemy(bossActorRef, amount, false, isExplosive ? 'RL-7 ロケット' : 'AR-7 カービン');
      stepSimulation(0.05, 1.5);
      renderSceneWithWater();
    }
  },
  triggerHotEvacuation: () => {
    launchHotEvacuation();
  },
  openHudEditor: () => {
    openCustomHudEditor();
  },
  syncAttachments: (weaponId: string) => {
    syncWeaponAttachments(weaponId);
  },
};

// Boot
const isAutomatedQa = captureMode || Boolean(navigator.webdriver) || Boolean(initialCamParam) || Boolean(initialUiParam);

const startOperationPipeline = () => {
  screensMgr.showPreload();
  audioSys.unlockAndPreload().catch(() => {});
  loadAllAssets()
    .catch((err) => {
      console.warn('Asset loading encountered fallback:', err);
      screensMgr.hidePreload();
      screensMgr.showPortal(
        () => launchInfiltrationCutscene(),
        () => {
          toggleLoadoutModal(true);
        }
      );
    })
    .finally(() => {
      loadAndApplyCustomHudLayout();
      syncWeaponAttachments(WEAPONS[activeWeaponIdx].id);
      if (initialCamParam) {
        applyNamedCamera(initialCamParam);
      }
      if (initialUiParam === 'loadout') {
        toggleLoadoutModal(true);
      } else if (initialUiParam === 'complete') {
        openMissionCompleteModal();
      }
      updateStatusHud();
      updateWeaponHud();
      updateGyroHudButtons();
      requestAnimationFrame(animate);
    });
};

// Boot immediately: warm up engine and assets, then present live 3D portal or direct QA harness
startOperationPipeline();
