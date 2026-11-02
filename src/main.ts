import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import blueprint from '../blueprints/night_port.json';

interface WeaponSpec {
  id: string;
  slot: number;
  name: string;
  category: string;
  desc: string;
  nodeName: string;
  fireMode: 'AUTO' | 'BOLT' | 'ROCKET';
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
    desc: '現代模組化突擊卡賓槍。配備全息反射瞄準鏡、M-LOK 護木與垂直前握把，兼具中近距離高射速與穩定後座力控制。',
    nodeName: 'AR7_Carbine',
    fireMode: 'AUTO',
    damage: 34,
    headshotMult: 2.2,
    fireInterval: 0.105,
    reloadTime: 1.55,
    magSize: 36,
    mag: 36,
    reserve: 120,
    recoilPitch: 0.016,
    recoilZ: 0.038,
    adsFov: 44,
    stats: { dmg: 48, rof: 82, stb: 78, rng: 68, cap: 36 },
    audioShot: 'assets/audio/ar7_shot.wav',
    silhouette: '︻╦╤─',
  },
  {
    id: 'sr9',
    slot: 2,
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
    slot: 3,
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
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  activeClip: string;
  hp: number;
  maxHp: number;
  state: 'PATROL' | 'ALERT' | 'COMBAT' | 'HIT' | 'DEAD';
  stateTimer: number;
  fireCooldown: number;
  patrolPoints: [number, number][];
  patrolIdx: number;
  baseY: number;
  muzzleFlash: THREE.Mesh;
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
      'assets/audio/sr9_shot.wav',
      'assets/audio/rl7_shot.wav',
      'assets/audio/explosion.wav',
      'assets/audio/reload.wav',
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
        try {
          const res = await fetch(url);
          const arr = await res.arrayBuffer();
          const buf = await this.ctx.decodeAudioData(arr);
          this.buffers.set(url, buf);
        } catch {
          // ignore decode error in headless environment
        }
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

  const moonLight = new THREE.DirectionalLight(0x9ec2ec, 2.35);
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
    [-7.5, 19.5, -18.0, 46], // Gantry Crane Overhead Floodlight
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

        // Enhance warm sodium/fire highlights reflected in the puddle
        vec3 deepWaterTint = vec3(0.025, 0.038, 0.055);
        vec3 finalCol = mix(deepWaterTint, reflCol * 1.18, fresnel);

        gl_FragColor = vec4(finalCol, puddleMask * (0.58 + 0.38 * fresnel));
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
weaponMount.add(muzzleLight);

const weaponModels: Record<string, THREE.Object3D> = {};
let activeWeaponIdx = 0;

// Player Third-Person (TPS) Full-Body CC0 65-Bone Actor (Toggled via [P] key!)
let playerTpsRoot: THREE.Group | null = null;
let playerTpsMixer: THREE.AnimationMixer | null = null;
const playerTpsActions: Record<string, THREE.AnimationAction> = {};
let playerTpsActiveClip = '';
const playerTpsWeapons: Record<string, THREE.Object3D> = {};

// Loadout 3D Showcase Turntable Group + Dedicated Studio Backdrop & 3-Point Lights
const loadoutShowcaseGroup = new THREE.Group();
loadoutShowcaseGroup.visible = false;
const loadoutWeaponHolder = new THREE.Group();
const loadoutBackdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(3.8, 2.4),
  new THREE.MeshBasicMaterial({ color: 0x080d14, transparent: true, opacity: 0.92, depthWrite: false })
);
loadoutBackdrop.position.set(-0.24, 0.02, -0.42);
const loadoutKeyLight = new THREE.PointLight(0xffffff, 15.0, 5.5, 1.05);
loadoutKeyLight.position.set(0.45, 0.55, 0.75);
const loadoutRimLight = new THREE.PointLight(0xffb84d, 11.5, 5.5, 1.05);
loadoutRimLight.position.set(-0.55, 0.35, -0.45);
const loadoutFillLight = new THREE.PointLight(0x8ab8ff, 8.5, 4.8, 1.1);
loadoutFillLight.position.set(0.0, -0.45, 0.65);
loadoutShowcaseGroup.add(loadoutBackdrop, loadoutWeaponHolder, loadoutKeyLight, loadoutRimLight, loadoutFillLight);
camera.add(loadoutShowcaseGroup);

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
const enemies: EnemyActor[] = [];

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
  const bandGeo = new THREE.CylinderGeometry(0.316, 0.316, 0.18, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9e1c16, roughness: 0.52, metalness: 0.58 });
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.65, metalness: 0.75 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xd49b1a, roughness: 0.48, metalness: 0.32 });
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
    mesh.add(ribTop, ribBot, hazBand);
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

// ---------------------------------------------------------------------------
// Load GLB Assets (port_environment.glb, weapons_pack.glb, soldier_tactical_animated.glb)
// ---------------------------------------------------------------------------
const gltfLoader = new GLTFLoader();

async function loadGlbAsset(relPath: string) {
  const preloaded = (window as unknown as { __PRELOADED_GLB_B64__?: Record<string, string> }).__PRELOADED_GLB_B64__?.[relPath];
  if (preloaded) {
    const binStr = atob(preloaded);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return gltfLoader.parseAsync(bytes.buffer, '');
  }
  return gltfLoader.loadAsync(relPath);
}

async function loadAllAssets() {
  const [portGltf, wepGltf, soldierGltf] = await Promise.all([
    loadGlbAsset('assets/models/port_environment.glb'),
    loadGlbAsset('assets/models/weapons_pack.glb'),
    loadGlbAsset('assets/models/soldier_tactical_animated.glb'),
  ]);

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
        m.visible = false; // Replaced by official Three.js Water.js instance (`harborSeaWater`)
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

  // 3. Spawn 8 CC0 Skinned & Animated Tactical Enemy Soldiers + Setup Player CC0 Arms & Third-Person Rig
  soldierTemplateGltf = { scene: soldierGltf.scene, animations: soldierGltf.animations };
  setupPlayerCc0ArmsAndThirdPerson();
  equipWeapon(0);
  spawnEnemySquad();
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
  fpArmsRoot.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const isArmsOrWatch =
        obj.name.includes('Soldier_CC0_Arms') ||
        obj.name.includes('WristWatch') ||
        obj.name.includes('WatchScreen') ||
        obj.parent?.name === 'Soldier_CC0_Arms' ||
        obj.parent?.name?.includes('WristWatch') ||
        obj.parent?.name?.includes('WatchScreen');
      obj.visible = Boolean(isArmsOrWatch);
      obj.frustumCulled = false;
      obj.castShadow = false;
      obj.receiveShadow = true;
    }
  });

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

function spawnEnemySquad() {
  if (!soldierTemplateGltf) return;
  // Clear existing
  for (const e of enemies) scene.remove(e.root);
  enemies.length = 0;

  const squadSpawns: { name: string; pos: [number, number, number]; patrol: [number, number][]; clip: string }[] = [
    { name: '武装兵 Alpha (West Dock)', pos: [-6.5, 0.0, 10.5], patrol: [[-6.5, 10.5], [-6.5, 1.5]], clip: 'Idle_Loop' },
    { name: '武装兵 Bravo (Crane Guard)', pos: [-5.2, 0.0, -9.5], patrol: [[-5.2, -9.5], [-8.2, -16.0]], clip: 'Walk_Loop' },
    { name: '武装兵 Charlie (Center Alley)', pos: [3.2, 0.0, 8.0], patrol: [[3.2, 8.0], [3.2, -2.0]], clip: 'Idle_Loop' },
    { name: '武装兵 Delta (Overhead Catwalk)', pos: [6.2, 5.34, 4.0], patrol: [[6.2, 4.0], [6.2, -8.0]], clip: 'Idle_Loop' },
    { name: '武装兵 Echo (Guard Post)', pos: [12.5, 0.0, 14.5], patrol: [[12.5, 14.5], [15.5, 8.5]], clip: 'Walk_Loop' },
    { name: '武装兵 Foxtrot (Warehouse Bay)', pos: [16.5, 0.0, -5.5], patrol: [[16.5, -5.5], [20.5, -12.0]], clip: 'Crouch_Idle_Loop' },
    { name: '武装兵 Golf (North Terminal)', pos: [0.5, 0.0, -19.5], patrol: [[0.5, -19.5], [-6.5, -21.0]], clip: 'Walk_Loop' },
    { name: '武装兵 Commander (Ship Deck)', pos: [-26.5, 6.6, -12.0], patrol: [[-26.5, -12.0], [-26.5, -4.0]], clip: 'Idle_Loop' },
  ];

  squadSpawns.forEach((sp, idx) => {
    const cloned = SkeletonUtils.clone(soldierTemplateGltf!.scene) as THREE.Group;
    cloned.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
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

    scene.add(cloned);

    const actor: EnemyActor = {
      id: `enemy_${idx + 1}`,
      name: sp.name,
      root: cloned,
      mixer,
      actions,
      activeClip: '',
      hp: 100,
      maxHp: 100,
      state: idx % 2 === 0 ? 'COMBAT' : 'PATROL',
      stateTimer: idx * 0.7,
      fireCooldown: 1.2 + idx * 0.3,
      patrolPoints: sp.patrol,
      patrolIdx: 0,
      baseY: sp.pos[1],
      muzzleFlash: mf,
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
  activeWeaponIdx = idx;
  player.reloading = false;
  document.getElementById('reload-box')?.classList.add('hidden');
  WEAPONS.forEach((w, i) => {
    if (weaponModels[w.id]) weaponModels[w.id].visible = i === idx;
    if (playerTpsWeapons[w.id]) playerTpsWeapons[w.id].visible = i === idx;
    document.getElementById(`slot-${i + 1}`)?.classList.toggle('active', i === idx);
  });
  updateWeaponHud();
  updateLoadoutModal(idx);
}

function setThirdPersonMode(enabled?: boolean) {
  player.thirdPerson = enabled !== undefined ? enabled : !player.thirdPerson;
  const inModal = loadoutOpen || missionModalOpen;
  fpRig.visible = !player.thirdPerson && !inModal && !player.fixedCameraKey;
  if (playerTpsRoot) {
    playerTpsRoot.visible = (player.thirdPerson || Boolean(player.fixedCameraKey)) && !inModal;
  }
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
  if (titleEl) titleEl.textContent = w.name;
  if (iconEl) iconEl.textContent = w.silhouette;
  if (magEl) magEl.textContent = String(w.mag).padStart(2, '0');
  if (resEl) resEl.textContent = String(w.reserve);
  if (modeEl) modeEl.textContent = w.fireMode;
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
  if (stanceEl) {
    const viewPrefix = player.thirdPerson ? '[TPS] ' : '[FPS] ';
    const stanceLabel = player.crouching
      ? 'CROUCH // 戰術蹲姿 (精準提升)'
      : player.sprinting
      ? 'SPRINT // 戰術衝刺'
      : 'STAND // 站立警戒';
    stanceEl.textContent = viewPrefix + stanceLabel;
  }
}

function updateObjectiveHud() {
  const alive = enemies.filter((e) => e.state !== 'DEAD').length;
  const total = enemies.length || 8;
  const killed = total - alive;
  const objText = document.getElementById('objective-text');
  if (objText) {
    objText.textContent =
      alive > 0
        ? `目標：肅清碼頭武裝守軍並奪還港務主控終端 (${killed} / ${total})`
        : '目標達成：港務主控終端已奪還！按 [M] 檢視作戰結算';
  }
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
  item.innerHTML = `<span class="kf-killer">あなた</span><span class="kf-weapon">[${weaponName}${headshot ? ' 🎯' : ''}]</span><span class="kf-victim">${victimName}</span>`;
  feed.prepend(item);
  while (feed.children.length > 4) {
    feed.removeChild(feed.lastChild!);
  }
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
}

function damageEnemy(enemy: EnemyActor, amount: number, isHeadshot: boolean, weaponLabel: string) {
  if (enemy.state === 'DEAD') return;
  enemy.hp -= amount;
  triggerHitmarker();

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
    playEnemyClip(enemy, 'Death01', false);
    player.kills++;
    if (isHeadshot) player.headshots++;
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
      setTimeout(() => openMissionCompleteModal(), 1200);
    }
  } else {
    enemy.state = 'HIT';
    enemy.stateTimer = 0.45;
    playEnemyClip(enemy, isHeadshot ? 'Hit_Head' : 'Hit_Chest', false);
  }
}

const raycaster = new THREE.Raycaster();
const shellGeo = new THREE.CylinderGeometry(0.0055, 0.006, 0.028, 8);
const shellMat = new THREE.MeshStandardMaterial({ color: 0xd8a838, roughness: 0.22, metalness: 0.92 });

function spawnEjectedShellAndTracer(camDir: THREE.Vector3, targetPoint: THREE.Vector3) {
  // 1. Eject Rotating Brass Shell Casing to the Right
  const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const ejectPos = camera.position
    .clone()
    .addScaledVector(camDir, 0.42)
    .addScaledVector(right, 0.18)
    .addScaledVector(up, -0.12);

  const shellMesh = new THREE.Mesh(shellGeo, shellMat);
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

  // 2. High-Velocity Ballistic Tracer Streak from Muzzle to Target
  const muzzleWorld = camera.position
    .clone()
    .addScaledVector(camDir, 0.75)
    .addScaledVector(right, player.ads ? 0.0 : 0.16)
    .addScaledVector(up, -0.11);
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([muzzleWorld, targetPoint]);
  const tracerMat = new THREE.LineBasicMaterial({
    color: 0xffd266,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(tracerGeo, tracerMat);
  scene.add(line);
  activeTracers.push({ line, age: 0 });
}

function fireCurrentWeapon() {
  const w = WEAPONS[activeWeaponIdx];
  if (player.reloading || player.fireTimer > 0) return;
  if (w.mag <= 0) {
    startReload();
    return;
  }

  w.mag--;
  player.shotsFired++;
  player.fireTimer = w.fireInterval;
  player.recoilOffsetZ = w.recoilZ;
  player.recoilPitch = w.recoilPitch;
  muzzleFlashMesh.material.opacity = 0.95;
  muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
  muzzleLight.intensity = 18.0;
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

  // Hitscan Raycast against Explosive Barrels & Enemy Hitboxes (Head vs Body)
  raycaster.set(camera.position, camDir);

  // 1. Check Explosive Barrels
  for (const barrel of explosiveBarrels) {
    if (barrel.exploded) continue;
    const hits = raycaster.intersectObject(barrel.mesh, false);
    if (hits.length > 0 && hits[0].distance < 95) {
      spawnEjectedShellAndTracer(camDir, hits[0].point);
      barrel.hp -= w.damage;
      audioSys.play3D('assets/audio/impact_metal.wav', hits[0].point, player.pos);
      if (barrel.hp <= 0) {
        barrel.exploded = true;
        barrel.mesh.visible = false;
        barrel.wreckGroup.visible = true;
        triggerExplosionAt(barrel.position, 8.0, 175);
      }
      return;
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
    const projHead = toHead.dot(camDir);
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
    const projBody = toBody.dot(camDir);
    if (projBody > 0 && projBody < bestDist) {
      const closestPt = camera.position.clone().addScaledVector(camDir, projBody);
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
    spawnEjectedShellAndTracer(camDir, hitPt);
    player.shotsHit++;
    const dmg = bestHeadshot ? w.damage * w.headshotMult : w.damage;
    damageEnemy(bestEnemy, dmg, bestHeadshot, w.name);
  } else {
    // Environment surface impact audio & tracer
    const envTarget = camera.position.clone().addScaledVector(camDir, 22);
    spawnEjectedShellAndTracer(camDir, envTarget);
    if (envTarget.y <= 0.15) {
      audioSys.play3D('assets/audio/impact_water.wav', envTarget, player.pos);
    } else {
      audioSys.play3D('assets/audio/impact_metal.wav', envTarget, player.pos);
    }
  }

  if (w.mag === 0 && w.reserve > 0) {
    setTimeout(() => startReload(), 250);
  }
}

// ---------------------------------------------------------------------------
// Loadout Inspection & Mission Complete Modals
// ---------------------------------------------------------------------------
let loadoutOpen = false;
let missionModalOpen = false;

function updateLoadoutModal(idx: number) {
  const w = WEAPONS[idx];
  const cat = document.getElementById('loadout-cat');
  const name = document.getElementById('loadout-name');
  const desc = document.getElementById('loadout-desc');
  if (cat) cat.textContent = w.category;
  if (name) name.textContent = w.name;
  if (desc) desc.textContent = w.desc;

  const setBar = (id: string, val: number, max = 100) => {
    const bar = document.getElementById(id);
    const v = document.getElementById(`${id}-v`);
    if (bar) bar.style.width = `${Math.min(100, (val / max) * 100)}%`;
    if (v) v.textContent = String(val);
  };
  setBar('stat-dmg', w.stats.dmg);
  setBar('stat-rof', w.stats.rof);
  setBar('stat-stb', w.stats.stb);
  setBar('stat-rng', w.stats.rng);
  setBar('stat-cap', w.stats.cap, 40);

  document.querySelectorAll('.loadout-tab').forEach((btn, bIdx) => {
    btn.classList.toggle('active', bIdx === idx);
  });

  // Update 3D showcase mesh in front of camera
  loadoutWeaponHolder.clear();
  if (weaponModels[w.id]) {
    const preview = weaponModels[w.id].clone(true);
    preview.visible = true;
    preview.scale.setScalar(1.45);
    preview.rotation.set(0.08, Math.PI * 0.46, 0.04);
    loadoutWeaponHolder.add(preview);
  }
  loadoutShowcaseGroup.position.set(0.24, -0.02, -0.98);
}

function toggleLoadoutModal(force?: boolean) {
  loadoutOpen = force !== undefined ? force : !loadoutOpen;
  document.getElementById('loadout-modal')?.classList.toggle('hidden', !loadoutOpen);
  document.getElementById('hud')?.classList.toggle('hidden', loadoutOpen || missionModalOpen);
  fpRig.visible = !player.thirdPerson && !loadoutOpen && !missionModalOpen && !player.fixedCameraKey;
  if (playerTpsRoot) playerTpsRoot.visible = player.thirdPerson && !loadoutOpen && !missionModalOpen;
  loadoutShowcaseGroup.visible = loadoutOpen;
  if (loadoutOpen) {
    updateLoadoutModal(activeWeaponIdx);
    if (document.pointerLockElement) document.exitPointerLock();
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
}

// ---------------------------------------------------------------------------
// Input Events
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  audioSys.unlockAndPreload();
  if (e.code === 'Digit1') equipWeapon(0);
  if (e.code === 'Digit2') equipWeapon(1);
  if (e.code === 'Digit3') equipWeapon(2);
  if (e.code === 'KeyR') startReload();
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

  // Enemy Blips
  for (const e of enemies) {
    if (e.state === 'DEAD') continue;
    mmCtx.fillStyle = '#ef4444';
    mmCtx.beginPath();
    mmCtx.arc(tx(e.root.position.x), tz(e.root.position.z), 3.6, 0, Math.PI * 2);
    mmCtx.fill();
  }

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
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
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
    player.sprinting = Boolean(keys['ShiftLeft'] || keys['ShiftRight']) && !player.crouching && !player.ads;
    const speed = player.crouching ? 2.8 : player.sprinting ? 6.4 : 4.3;

    const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const move = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp']) move.add(fwd);
    if (keys['KeyS'] || keys['ArrowDown']) move.sub(fwd);
    if (keys['KeyD'] || keys['ArrowRight']) move.add(right);
    if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);

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

    if (player.thirdPerson) {
      // Over-the-Shoulder Third-Person Tactical Camera
      const camBack = player.ads ? 1.38 : 2.38;
      const camRight = player.ads ? 0.44 : 0.56;
      const camUp = eyeHeight + (player.crouching ? 0.22 : 0.18);
      camera.position.set(
        player.pos.x + right.x * camRight - fwd.x * camBack + shakeX,
        player.pos.y + camUp + bobY * 0.5 + shakeY,
        player.pos.z + right.z * camRight - fwd.z * camBack
      );
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch + player.recoilPitch + shakeY * 0.35 - 0.04;
    } else {
      camera.position.set(player.pos.x + bobX + shakeX, player.pos.y + eyeHeight + bobY + shakeY, player.pos.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = player.yaw;
      camera.rotation.x = player.pitch + player.recoilPitch + shakeY * 0.35;
    }

    // Smooth ADS FOV & Viewmodel Position
    const w = WEAPONS[activeWeaponIdx];
    const targetFov = player.ads ? w.adsFov : 60;
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();

    const targetRigX = player.ads ? 0.0 : 0.22;
    const targetRigY = player.ads ? -0.145 : -0.24;
    const targetRigZ = (player.ads ? -0.28 : -0.38) + player.recoilOffsetZ;
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
    } else {
      weaponMount.rotation.x *= 0.85;
      weaponMount.rotation.z *= 0.85;
    }

    // Solve Two-Handed Rifle IK for First-Person CC0 Arms against active weapon grip & foregrip
    updateFirstPersonCc0HandsIk();

    // Auto-fire for AR-7
    if (mouseDownLeft && w.fireMode === 'AUTO') {
      fireCurrentWeapon();
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
    sp.mesh.position.y += dt * 0.9;
    (sp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.52 * (1 - p));
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

  // 5. Update Enemy Tactical Soldiers & CC0 Skeletal Animations
  if (!captureMode) {
    for (const e of enemies) {
      e.mixer.update(dt);
      // Foot Lock / Ground Clamp
      e.root.position.y = e.baseY;
      if ((e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity > 0) {
        (e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0,
          (e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity - dt * 12
        );
      }
      if (e.state === 'DEAD') continue;

      const toPlayer = new THREE.Vector3(
        player.pos.x - e.root.position.x,
        0,
        player.pos.z - e.root.position.z
      );
      const dist = toPlayer.length();

      if (e.state === 'HIT') {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.state = 'COMBAT';
          playEnemyClip(e, 'Idle_Loop', true);
        }
        poseCharacterTwoHandRifleIk(e.root, undefined, e.baseY > 2.5 ? -0.22 : 0.0, 0, 0);
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
        poseCharacterTwoHandRifleIk(e.root, undefined, -0.06, 0, 0);
        if (dist < 22) {
          e.state = 'COMBAT';
        }
      } else if (e.state === 'COMBAT') {
        e.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        playEnemyClip(e, 'Idle_Loop', true);
        poseCharacterTwoHandRifleIk(e.root, undefined, e.baseY > 2.5 ? -0.22 : 0.0, 0, 0);
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && dist < 34) {
          e.fireCooldown = 1.45 + Math.random() * 0.8;
          (e.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0.95;
          audioSys.play3D('assets/audio/ar7_shot.wav', e.root.position, player.pos, 5, 45, 0.55);

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

  renderMinimap();
}

function renderSceneWithWater(forceReflection = true) {
  if (forceReflection) {
    renderer.shadowMap.needsUpdate = true;
    updateGroundPlanarReflection();
  } else {
    reflectionFrameTick++;
    if (reflectionFrameTick % 4 === 0) renderer.shadowMap.needsUpdate = true;
    if (reflectionFrameTick % 2 === 0) updateGroundPlanarReflection();
  }
  renderer.render(scene, camera);
}

function animate(now: number) {
  requestAnimationFrame(animate);
  const rawDt = now - lastTime;
  lastTime = now;
  if (rawDt > 0 && rawDt < 500) {
    frameTimesMs.push(rawDt);
    if (frameTimesMs.length > 180) frameTimesMs.shift();
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
  reload: () => {
    const w = WEAPONS[activeWeaponIdx];
    w.mag = Math.max(1, w.mag - 5);
    startReload();
    stepSimulation(0.35, 1.5);
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
    document.getElementById('hud')?.classList.remove('hidden');
    fpRig.visible = true;
    renderSceneWithWater();
  },
  getPerf: () => getPerfSummary(),
  getState: () => ({
    playerPos: player.pos.toArray(),
    yaw: player.yaw,
    pitch: player.pitch,
    hp: player.hp,
    armor: player.armor,
    activeWeapon: WEAPONS[activeWeaponIdx].name,
    mag: WEAPONS[activeWeaponIdx].mag,
    enemiesAlive: enemies.filter((e) => e.state !== 'DEAD').length,
    enemiesTotal: enemies.length,
    kills: player.kills,
  }),
};

// Boot
loadAllAssets().then(() => {
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
  requestAnimationFrame(animate);
});
