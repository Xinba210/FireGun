/**
 * FireGun Realistic FPS — PBR Texture & Binary glTF 2.0 (GLB) Asset Builder
 * Generates:
 *  1. High-resolution Procedural PBR Texture Maps (Albedo, Normal, Roughness/Metallic) in public/assets/textures/
 *  2. public/assets/models/port_environment.glb — Modular Night Port 3D Scene (Cargo Ship, Gantry Crane, Containers, Warehouse, Guard Post, Catwalk, Puddles, Fire Barrels)
 *  3. public/assets/models/weapons_pack.glb — Detailed 3D Tactical Weapons (AR-7 Carbine, SR-9 Sniper, RL-7 Rocket Launcher) + FP Arms
 *  4. public/assets/models/soldier_tactical_animated.glb — Quaternius CC0 65-Bone Skinned Tactical Soldier (Male_Ranger modular parts + Superhero Head/Hands + Rigid Tactical Helmet, Plate Carrier Pouches, and AR-7 Carbine attached to bones) with 43 UAL1 animations!
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_MODELS = 'public/assets/models';
const OUT_TEX = 'public/assets/textures';
const OUT_LICENSES = 'public/assets/licenses';
fs.mkdirSync(OUT_MODELS, { recursive: true });
fs.mkdirSync(OUT_TEX, { recursive: true });
fs.mkdirSync(OUT_LICENSES, { recursive: true });

// Copy verified CC0 licenses to public/assets/licenses/
fs.copyFileSync('assets/source_cc0/quaternius/LICENSE.txt', path.join(OUT_LICENSES, 'Quaternius_CC0_LICENSE.txt'));
fs.copyFileSync('assets/source_cc0/kaykit/LICENSE.txt', path.join(OUT_LICENSES, 'KayKit_CC0_LICENSE.txt'));

// ---------------------------------------------------------------------------
// 1. Minimal PNG Encoder for generating genuine PBR textures (Albedo, Normal, ORM)
// ---------------------------------------------------------------------------
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function hash2(x, y, seed = 1) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function fbm(u, v, freq = 8, octaves = 4, seed = 1) {
  let val = 0, amp = 0.5, sumAmp = 0;
  for (let o = 0; o < octaves; o++) {
    const x = u * freq, y = v * freq;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    const n00 = hash2(xi, yi, seed + o * 17);
    const n10 = hash2(xi + 1, yi, seed + o * 17);
    const n01 = hash2(xi, yi + 1, seed + o * 17);
    const n11 = hash2(xi + 1, yi + 1, seed + o * 17);
    const nx0 = n00 + sx * (n10 - n00);
    const nx1 = n01 + sx * (n11 - n01);
    val += (nx0 + sy * (nx1 - nx0)) * amp;
    sumAmp += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / sumAmp;
}

function generatePbrSet(name, size, evalPixel) {
  const albedo = Buffer.alloc(size * size * 4);
  const orm = Buffer.alloc(size * size * 4);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const p = evalPixel(u, v, x, y);
      const idx = (y * size + x) * 4;
      albedo[idx] = Math.max(0, Math.min(255, Math.round(p.r * 255)));
      albedo[idx + 1] = Math.max(0, Math.min(255, Math.round(p.g * 255)));
      albedo[idx + 2] = Math.max(0, Math.min(255, Math.round(p.b * 255)));
      albedo[idx + 3] = 255;
      // glTF metallicRoughness: G = Roughness, B = Metallic, R = Occlusion
      orm[idx] = Math.max(0, Math.min(255, Math.round((p.ao ?? 1.0) * 255)));
      orm[idx + 1] = Math.max(0, Math.min(255, Math.round(p.roughness * 255)));
      orm[idx + 2] = Math.max(0, Math.min(255, Math.round(p.metallic * 255)));
      orm[idx + 3] = 255;
      heights[y * size + x] = p.height ?? 0.5;
    }
  }

  const normal = Buffer.alloc(size * size * 4);
  const strength = 2.15;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = heights[y * size + ((x - 1 + size) % size)];
      const hR = heights[y * size + ((x + 1) % size)];
      const hD = heights[((y - 1 + size) % size) * size + x];
      const hU = heights[((y + 1) % size) * size + x];
      let nx = (hL - hR) * strength;
      let ny = (hD - hU) * strength;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen; ny *= invLen; nz *= invLen;
      const idx = (y * size + x) * 4;
      normal[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normal[idx + 3] = 255;
    }
  }

  const albedoPng = encodePNG(size, size, albedo);
  const normalPng = encodePNG(size, size, normal);
  const ormPng = encodePNG(size, size, orm);
  fs.writeFileSync(path.join(OUT_TEX, `${name}_albedo.png`), albedoPng);
  fs.writeFileSync(path.join(OUT_TEX, `${name}_normal.png`), normalPng);
  fs.writeFileSync(path.join(OUT_TEX, `${name}_orm.png`), ormPng);
  return { albedoPng, normalPng, ormPng };
}

console.log('Generating high-detail PBR texture maps...');
const TEX_SETS = {
  wet_concrete: generatePbrSet('wet_concrete', 256, (u, v) => {
    const macro = fbm(u, v, 4, 4, 11);
    const micro = fbm(u, v, 28, 3, 29);
    const asphaltGrain = fbm(u * 2.5, v * 2.5, 42, 2, 77);
    const puddleField = fbm(u, v, 3, 4, 99);
    // Smooth rain-slicked tarmac wetness transition without marbled cracks
    const wetness = Math.max(0, Math.min(1, (puddleField - 0.50) * 4.5));
    const crackVal = Math.abs(fbm(u, v, 10, 3, 42) - 0.5);
    const crack = crackVal < 0.008 ? 0.90 : 1.0;
    const tireTrack = Math.sin(u * Math.PI * 16) > 0.88 ? 0.95 : 1.0;
    const dryLuma = (0.16 + macro * 0.05 + micro * 0.03 + asphaltGrain * 0.025) * crack * tireTrack;
    const base = dryLuma * (1.0 - wetness * 0.36);
    const dryHeight = (0.42 + macro * 0.16 + micro * 0.12 + asphaltGrain * 0.10) * crack;
    return {
      r: base * 0.92,
      g: base * 0.97,
      b: base * 1.08,
      roughness: 0.62 - wetness * 0.50 - micro * 0.03,
      metallic: 0.08 + wetness * 0.26,
      height: dryHeight * (1.0 - wetness * 0.85) + 0.5 * (wetness * 0.85),
      ao: crack * (0.94 + micro * 0.06),
    };
  }),
  container_red: generatePbrSet('container_red', 256, (u, v) => {
    const ribWave = Math.sin(u * Math.PI * 44);
    const rib = Math.sign(ribWave) * Math.pow(Math.abs(ribWave), 0.55);
    const streak = fbm(u * 6, v * 1.8, 8, 3, 19);
    const edgeWear = (v < 0.05 || v > 0.95 || u < 0.03 || u > 0.97) ? 0.35 : 0.0;
    const rustNoise = fbm(u, v, 16, 4, 21) + edgeWear * 0.45 - Math.abs(rib) * 0.15;
    const rust = Math.max(0, Math.min(1, (rustNoise - 0.74) * 6.0));
    const grime = fbm(u, v, 10, 3, 33) * 0.7 + streak * 0.3;
    const shade = (0.82 + rib * 0.14) * (0.76 + grime * 0.28) * (1.0 - v * 0.12);
    return {
      r: (1 - rust) * (0.52 * shade) + rust * 0.31,
      g: (1 - rust) * (0.13 * shade) + rust * 0.15,
      b: (1 - rust) * (0.12 * shade) + rust * 0.11,
      roughness: 0.38 + grime * 0.22 + rust * 0.32,
      metallic: (1 - rust) * 0.38 + rust * 0.12,
      height: 0.5 + rib * 0.38 - rust * 0.08,
      ao: 0.84 + rib * 0.16,
    };
  }),
  container_blue: generatePbrSet('container_blue', 256, (u, v) => {
    const ribWave = Math.sin(u * Math.PI * 44);
    const rib = Math.sign(ribWave) * Math.pow(Math.abs(ribWave), 0.55);
    const streak = fbm(u * 6, v * 1.8, 8, 3, 49);
    const edgeWear = (v < 0.05 || v > 0.95 || u < 0.03 || u > 0.97) ? 0.35 : 0.0;
    const rustNoise = fbm(u, v, 16, 4, 51) + edgeWear * 0.45 - Math.abs(rib) * 0.15;
    const rust = Math.max(0, Math.min(1, (rustNoise - 0.75) * 6.0));
    const grime = fbm(u, v, 10, 3, 63) * 0.7 + streak * 0.3;
    const shade = (0.82 + rib * 0.14) * (0.76 + grime * 0.28) * (1.0 - v * 0.12);
    return {
      r: (1 - rust) * (0.13 * shade) + rust * 0.29,
      g: (1 - rust) * (0.26 * shade) + rust * 0.16,
      b: (1 - rust) * (0.46 * shade) + rust * 0.12,
      roughness: 0.38 + grime * 0.22 + rust * 0.32,
      metallic: (1 - rust) * 0.38 + rust * 0.12,
      height: 0.5 + rib * 0.38 - rust * 0.08,
      ao: 0.84 + rib * 0.16,
    };
  }),
  container_green: generatePbrSet('container_green', 256, (u, v) => {
    const ribWave = Math.sin(u * Math.PI * 44);
    const rib = Math.sign(ribWave) * Math.pow(Math.abs(ribWave), 0.55);
    const streak = fbm(u * 6, v * 1.8, 8, 3, 69);
    const edgeWear = (v < 0.05 || v > 0.95 || u < 0.03 || u > 0.97) ? 0.35 : 0.0;
    const rustNoise = fbm(u, v, 16, 4, 71) + edgeWear * 0.45 - Math.abs(rib) * 0.15;
    const rust = Math.max(0, Math.min(1, (rustNoise - 0.75) * 6.0));
    const grime = fbm(u, v, 10, 3, 83) * 0.7 + streak * 0.3;
    const shade = (0.82 + rib * 0.14) * (0.76 + grime * 0.28) * (1.0 - v * 0.12);
    return {
      r: (1 - rust) * (0.17 * shade) + rust * 0.29,
      g: (1 - rust) * (0.30 * shade) + rust * 0.16,
      b: (1 - rust) * (0.20 * shade) + rust * 0.12,
      roughness: 0.40 + grime * 0.22 + rust * 0.32,
      metallic: (1 - rust) * 0.36 + rust * 0.12,
      height: 0.5 + rib * 0.38 - rust * 0.08,
      ao: 0.84 + rib * 0.16,
    };
  }),
  rusted_steel: generatePbrSet('rusted_steel', 256, (u, v) => {
    const n = fbm(u, v, 10, 4, 105);
    const streak = fbm(u * 8, v * 2, 6, 3, 155);
    const rustRaw = fbm(u, v, 14, 4, 205) * 0.75 + streak * 0.25;
    const rust = Math.max(0, Math.min(1, (rustRaw - 0.62) * 4.5));
    const seam = (Math.abs((u * 4) % 1) < 0.022 || Math.abs((v * 4) % 1) < 0.022) ? 0.74 : 1.0;
    const steelR = 0.22 + n * 0.08;
    const steelG = 0.25 + n * 0.08;
    const steelB = 0.29 + n * 0.09;
    return {
      r: ((1 - rust) * steelR + rust * 0.36) * seam,
      g: ((1 - rust) * steelG + rust * 0.19) * seam,
      b: ((1 - rust) * steelB + rust * 0.13) * seam,
      roughness: (1 - rust) * (0.36 + n * 0.16) + rust * 0.78,
      metallic: (1 - rust) * 0.56 + rust * 0.18,
      height: (0.5 + (n - 0.5) * 0.26 - rust * 0.06) * seam,
      ao: seam,
    };
  }),
  gunmetal_pbr: generatePbrSet('gunmetal_pbr', 256, (u, v) => {
    const brush = fbm(u * 4, v * 24, 12, 3, 301);
    const edgeWear = fbm(u, v, 18, 3, 309) > 0.74 ? 0.14 : 0.0;
    const base = 0.18 + brush * 0.07 + edgeWear;
    return {
      r: base,
      g: base * 1.03,
      b: base * 1.08,
      roughness: 0.28 + brush * 0.12 - edgeWear * 0.3,
      metallic: 0.64,
      height: 0.5 + (brush - 0.5) * 0.18,
      ao: 0.95,
    };
  }),
  wood_crate: generatePbrSet('wood_crate', 256, (u, v) => {
    const grain = fbm(u * 2, v * 18, 10, 3, 401);
    const plank = Math.abs((v * 6) % 1) < 0.04 ? 0.62 : 1.0;
    const frame = (u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92 || Math.abs(u - v) < 0.05) ? 0.78 : 1.0;
    const dirt = fbm(u, v, 8, 3, 419);
    const base = (0.14 + grain * 0.08) * plank * frame * (0.75 + dirt * 0.35);
    return {
      r: base * 1.18,
      g: base * 0.86,
      b: base * 0.54,
      roughness: 0.78 + (1 - plank) * 0.15,
      metallic: 0.04,
      height: (0.4 + grain * 0.3) * plank * frame,
      ao: plank * frame,
    };
  }),
  tactical_camo: generatePbrSet('tactical_camo', 256, (u, v) => {
    const c1 = fbm(u, v, 6, 3, 501);
    const c2 = fbm(u, v, 12, 3, 521);
    const panel = (Math.abs((u * 2) % 1) < 0.025 || Math.abs((v * 2) % 1) < 0.025) ? 0.72 : 1.0;
    const patch = c1 > 0.56 ? 0.75 : c2 < 0.42 ? 1.15 : 0.95;
    return {
      r: 0.11 * patch * panel,
      g: 0.13 * patch * panel,
      b: 0.09 * patch * panel,
      roughness: 0.58 + c2 * 0.16,
      metallic: 0.24,
      height: (0.5 + (c2 - 0.5) * 0.2) * panel,
      ao: panel,
    };
  }),
};

// ---------------------------------------------------------------------------
// 2. Binary glTF 2.0 (GLB) Builder Engine
// ---------------------------------------------------------------------------
class GlbBuilder {
  constructor() {
    this.buffers = [];
    this.bufferViews = [];
    this.accessors = [];
    this.images = [];
    this.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    this.textures = [];
    this.materials = [];
    this.meshes = [];
    this.nodes = [];
    this.RootNodes = [];
    this.byteOffset = 0;
  }

  addBufferChunk(buf, target) {
    const pad = (4 - (buf.length % 4)) % 4;
    const padded = pad ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf;
    const viewIndex = this.bufferViews.length;
    const view = { buffer: 0, byteOffset: this.byteOffset, byteLength: buf.length };
    if (target) view.target = target;
    this.bufferViews.push(view);
    this.buffers.push(padded);
    this.byteOffset += padded.length;
    return viewIndex;
  }

  addImagePng(pngBuffer, name) {
    const bv = this.addBufferChunk(pngBuffer);
    const imgIdx = this.images.length;
    this.images.push({ name, bufferView: bv, mimeType: 'image/png' });
    const texIdx = this.textures.length;
    this.textures.push({ source: imgIdx, sampler: 0 });
    return texIdx;
  }

  addPbrTextureMaterial(name, texSet, extra = {}) {
    const baseColorTex = this.addImagePng(texSet.albedoPng, `${name}_albedo`);
    const normalTex = this.addImagePng(texSet.normalPng, `${name}_normal`);
    const ormTex = this.addImagePng(texSet.ormPng, `${name}_orm`);
    const matIdx = this.materials.length;
    this.materials.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: extra.baseColorFactor || [1, 1, 1, 1],
        baseColorTexture: { index: baseColorTex },
        metallicRoughnessTexture: { index: ormTex },
        metallicFactor: extra.metallicFactor ?? 1.0,
        roughnessFactor: extra.roughnessFactor ?? 1.0,
      },
      normalTexture: { index: normalTex, scale: extra.normalScale ?? 1.0 },
      occlusionTexture: { index: ormTex, strength: 0.85 },
      emissiveFactor: extra.emissiveFactor || [0, 0, 0],
      doubleSided: extra.doubleSided ?? false,
    });
    return matIdx;
  }

  addSolidPbrMaterial(name, color, roughness = 0.5, metallic = 0.2, emissive = [0, 0, 0], alphaMode = undefined) {
    const matIdx = this.materials.length;
    const mat = {
      name,
      pbrMetallicRoughness: {
        baseColorFactor: color,
        roughnessFactor: roughness,
        metallicFactor: metallic,
      },
      emissiveFactor: emissive,
    };
    if (alphaMode) mat.alphaMode = alphaMode;
    this.materials.push(mat);
    return matIdx;
  }

  addMeshPrimitive(name, positions, normals, uvs, indices, materialIndex) {
    const posArr = new Float32Array(positions);
    const normArr = new Float32Array(normals);
    const uvArr = new Float32Array(uvs);
    const idxArr = new Uint32Array(indices);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posArr.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (posArr[i + k] < min[k]) min[k] = posArr[i + k];
        if (posArr[i + k] > max[k]) max[k] = posArr[i + k];
      }
    }

    const posBv = this.addBufferChunk(Buffer.from(posArr.buffer), 34962);
    const normBv = this.addBufferChunk(Buffer.from(normArr.buffer), 34962);
    const uvBv = this.addBufferChunk(Buffer.from(uvArr.buffer), 34962);
    const idxBv = this.addBufferChunk(Buffer.from(idxArr.buffer), 34963);

    const posAcc = this.accessors.length;
    this.accessors.push({ bufferView: posBv, componentType: 5126, count: posArr.length / 3, type: 'VEC3', min, max });
    const normAcc = this.accessors.length;
    this.accessors.push({ bufferView: normBv, componentType: 5126, count: normArr.length / 3, type: 'VEC3' });
    const uvAcc = this.accessors.length;
    this.accessors.push({ bufferView: uvBv, componentType: 5126, count: uvArr.length / 2, type: 'VEC2' });
    const idxAcc = this.accessors.length;
    this.accessors.push({ bufferView: idxBv, componentType: 5125, count: idxArr.length, type: 'SCALAR' });

    return {
      attributes: { POSITION: posAcc, NORMAL: normAcc, TEXCOORD_0: uvAcc },
      indices: idxAcc,
      material: materialIndex,
    };
  }

  addNode(name, primitives, translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1], children = undefined) {
    let meshIdx;
    if (primitives && primitives.length > 0) {
      meshIdx = this.meshes.length;
      this.meshes.push({ name: `${name}_Mesh`, primitives });
    }
    const nodeIdx = this.nodes.length;
    const node = { name, translation, rotation, scale };
    if (meshIdx !== undefined) node.mesh = meshIdx;
    if (children && children.length > 0) node.children = children;
    this.nodes.push(node);
    return nodeIdx;
  }

  toGlbBuffer() {
    const binChunk = Buffer.concat(this.buffers);
    const jsonObj = {
      asset: { version: '2.0', generator: 'FireGun Blender/glTF2 Asset Pipeline v0.1.0' },
      scene: 0,
      scenes: [{ name: 'Scene', nodes: this.RootNodes }],
      nodes: this.nodes,
      meshes: this.meshes,
      materials: this.materials,
      samplers: this.textures.length ? this.samplers : undefined,
      textures: this.textures.length ? this.textures : undefined,
      images: this.images.length ? this.images : undefined,
      accessors: this.accessors,
      bufferViews: this.bufferViews,
      buffers: [{ byteLength: binChunk.length }],
    };
    const jsonStr = JSON.stringify(jsonObj);
    const jsonPad = (4 - (Buffer.byteLength(jsonStr) % 4)) % 4;
    const jsonBuf = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf8');

    const totalLen = 12 + 8 + jsonBuf.length + 8 + binChunk.length;
    const header = Buffer.alloc(12);
    header.write('glTF', 0, 4, 'ascii');
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(totalLen, 8);

    const jsonHead = Buffer.alloc(8);
    jsonHead.writeUInt32LE(jsonBuf.length, 0);
    jsonHead.write('JSON', 4, 4, 'ascii');

    const binHead = Buffer.alloc(8);
    binHead.writeUInt32LE(binChunk.length, 0);
    binHead.write('BIN\x00', 4, 4, 'ascii');

    return Buffer.concat([header, jsonHead, jsonBuf, binHead, binChunk]);
  }
}

// Geometry helpers (Box, Cylinder, Corrugated Container, Truss, Ship Hull)
function makeGeometryCollector() {
  return { positions: [], normals: [], uvs: [], indices: [] };
}

function appendBox(geom, cx, cy, cz, sx, sy, sz, uvScale = 1) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], u: [sx, sy] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], u: [sx, sy] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], u: [sz, sy] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], u: [sz, sy] },
    // Top/Bottom faces map U along the longer horizontal dimension so rotated container roofs never show perpendicular stripes!
    { n: [0, 1, 0], v: sx > sz ? [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]] : [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], u: sx > sz ? [sz, sx] : [sx, sz] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], u: [sx, sz] },
  ];
  for (const f of faces) {
    const base = geom.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      geom.positions.push(cx + f.v[i][0], cy + f.v[i][1], cz + f.v[i][2]);
      geom.normals.push(f.n[0], f.n[1], f.n[2]);
    }
    const uMax = f.u[0] * uvScale, vMax = f.u[1] * uvScale;
    geom.uvs.push(0, 0, uMax, 0, uMax, vMax, 0, vMax);
    geom.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function appendRotatedYBox(geom, cx, cy, cz, sx, sy, sz, angleRad = 0, uvScale = 1) {
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const ca = Math.cos(angleRad), sa = Math.sin(angleRad);
  const rot = (x, y, z) => [cx + x * ca + z * sa, cy + y, cz - x * sa + z * ca];
  const rotN = (nx, ny, nz) => [nx * ca + nz * sa, ny, -nx * sa + nz * ca];
  const faces = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], u: [sx, sy] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], u: [sx, sy] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], u: [sz, sy] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], u: [sz, sy] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], u: [sx, sz] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], u: [sx, sz] },
  ];
  for (const f of faces) {
    const base = geom.positions.length / 3;
    const rn = rotN(f.n[0], f.n[1], f.n[2]);
    for (let i = 0; i < 4; i++) {
      const rp = rot(f.v[i][0], f.v[i][1], f.v[i][2]);
      geom.positions.push(rp[0], rp[1], rp[2]);
      geom.normals.push(rn[0], rn[1], rn[2]);
    }
    const uMax = f.u[0] * uvScale, vMax = f.u[1] * uvScale;
    geom.uvs.push(0, 0, uMax, 0, uMax, vMax, 0, vMax);
    geom.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function appendJerseyBarrier(geom, cx, cz, len = 2.75, angleRad = 0, uvScale = 0.5) {
  // Authentic sloped concrete Jersey Barrier cross-section profile:
  // y=0.00 (half-width 0.42) -> y=0.22 (0.38) -> y=0.52 (0.20) -> y=1.02 (0.13)
  const prof = [
    [0.00, 0.42],
    [0.22, 0.38],
    [0.52, 0.20],
    [1.02, 0.13],
  ];
  const hx = len / 2;
  const ca = Math.cos(angleRad), sa = Math.sin(angleRad);
  const rot = (x, y, z) => [cx + x * ca + z * sa, y, cz - x * sa + z * ca];
  const rotN = (nx, ny, nz) => [nx * ca + nz * sa, ny, -nx * sa + nz * ca];

  function addQuad(v0, v1, v2, v3, nx, ny, nz, uLen, vLen) {
    const base = geom.positions.length / 3;
    const rn = rotN(nx, ny, nz);
    for (const v of [v0, v1, v2, v3]) {
      const rp = rot(v[0], v[1], v[2]);
      geom.positions.push(rp[0], rp[1], rp[2]);
      geom.normals.push(rn[0], rn[1], rn[2]);
    }
    const uM = uLen * uvScale, vM = vLen * uvScale;
    geom.uvs.push(0, 0, uM, 0, uM, vM, 0, vM);
    geom.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  for (let i = 0; i < prof.length - 1; i++) {
    const [y0, z0] = prof[i];
    const [y1, z1] = prof[i + 1];
    const dy = y1 - y0, dz = z0 - z1;
    const nl = Math.hypot(dy, dz) || 1;
    const ny = dz / nl, nz = dy / nl;
    // Front sloped face (+Z)
    addQuad([-hx, y0, z0], [hx, y0, z0], [hx, y1, z1], [-hx, y1, z1], 0, ny, nz, len, nl);
    // Back sloped face (-Z)
    addQuad([hx, y0, -z0], [-hx, y0, -z0], [-hx, y1, -z1], [hx, y1, -z1], 0, ny, -nz, len, nl);
    // Left & Right end caps
    addQuad([hx, y0, z0], [hx, y0, -z0], [hx, y1, -z1], [hx, y1, z1], 1, 0, 0, z0 * 2, dy);
    addQuad([-hx, y0, -z0], [-hx, y0, z0], [-hx, y1, z1], [-hx, y1, -z1], -1, 0, 0, z0 * 2, dy);
  }
  const [yTop, zTop] = prof[prof.length - 1];
  addQuad([-hx, yTop, zTop], [hx, yTop, zTop], [hx, yTop, -zTop], [-hx, yTop, -zTop], 0, 1, 0, len, zTop * 2);
}

function appendCylinder(geom, cx, cy, cz, rTop, rBot, height, segs = 16, axis = 'y') {
  const half = height / 2;
  const base = geom.positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < 2; j++) {
      const r = j === 0 ? rBot : rTop;
      const h = j === 0 ? -half : half;
      let px, py, pz, nx, ny, nz;
      if (axis === 'y') {
        px = cx + ca * r; py = cy + h; pz = cz + sa * r;
        nx = ca; ny = 0; nz = sa;
      } else if (axis === 'z') {
        px = cx + ca * r; py = cy + sa * r; pz = cz + h;
        nx = ca; ny = sa; nz = 0;
      } else {
        px = cx + h; py = cy + ca * r; pz = cz + sa * r;
        nx = 0; ny = ca; nz = sa;
      }
      geom.positions.push(px, py, pz);
      geom.normals.push(nx, ny, nz);
      geom.uvs.push(t, j);
    }
  }
  for (let i = 0; i < segs; i++) {
    const i0 = base + i * 2;
    if (axis === 'y') {
      geom.indices.push(i0, i0 + 2, i0 + 3, i0, i0 + 3, i0 + 1);
    } else {
      geom.indices.push(i0, i0 + 3, i0 + 2, i0, i0 + 1, i0 + 3);
    }
  }
  // Add Top and Bottom Disc Caps so cylinders are solid 3D volumes
  for (let cap = 0; cap < 2; cap++) {
    const r = cap === 0 ? rBot : rTop;
    if (r <= 1e-4) continue;
    const h = cap === 0 ? -half : half;
    const sgn = cap === 0 ? -1 : 1;
    let nx = 0, ny = 0, nz = 0;
    if (axis === 'y') ny = sgn;
    else if (axis === 'z') nz = sgn;
    else nx = sgn;

    const cIdx = geom.positions.length / 3;
    geom.positions.push(
      axis === 'x' ? cx + h : cx,
      axis === 'y' ? cy + h : cy,
      axis === 'z' ? cz + h : cz
    );
    geom.normals.push(nx, ny, nz);
    geom.uvs.push(0.5, 0.5);

    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      let px = cx, py = cy, pz = cz;
      if (axis === 'y') { px += ca * r; py += h; pz += sa * r; }
      else if (axis === 'z') { px += ca * r; py += sa * r; pz += h; }
      else { px += h; py += ca * r; pz += sa * r; }
      geom.positions.push(px, py, pz);
      geom.normals.push(nx, ny, nz);
      geom.uvs.push(0.5 + ca * 0.5, 0.5 + sa * 0.5);
    }
    for (let i = 0; i < segs; i++) {
      const flip = (axis === 'y') ? (cap === 1) : (cap === 0);
      if (flip) {
        geom.indices.push(cIdx, cIdx + 1 + i + 1, cIdx + 1 + i);
      } else {
        geom.indices.push(cIdx, cIdx + 1 + i, cIdx + 1 + i + 1);
      }
    }
  }
}

function appendBeam(geom, x1, y1, z1, x2, y2, z2, r = 0.08, segs = 6) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  const dir = [dx / len, dy / len, dz / len];
  const up = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let ux = dir[1] * up[2] - dir[2] * up[1];
  let uy = dir[2] * up[0] - dir[0] * up[2];
  let uz = dir[0] * up[1] - dir[1] * up[0];
  const uLen = Math.hypot(ux, uy, uz) || 1;
  ux /= uLen; uy /= uLen; uz /= uLen;
  const vx = dir[1] * uz - dir[2] * uy;
  const vy = dir[2] * ux - dir[0] * uz;
  const vz = dir[0] * uy - dir[1] * ux;

  const base = geom.positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const nx = ux * ca + vx * sa;
    const ny = uy * ca + vy * sa;
    const nz = uz * ca + vz * sa;
    geom.positions.push(x1 + nx * r, y1 + ny * r, z1 + nz * r);
    geom.normals.push(nx, ny, nz);
    geom.uvs.push(t, 0);
    geom.positions.push(x2 + nx * r, y2 + ny * r, z2 + nz * r);
    geom.normals.push(nx, ny, nz);
    geom.uvs.push(t, len * 0.5);
  }
  for (let i = 0; i < segs; i++) {
    const i0 = base + i * 2;
    geom.indices.push(i0, i0 + 2, i0 + 3, i0, i0 + 3, i0 + 1);
  }
}

function appendCatenaryChain(geom, x1, y1, z1, x2, y2, z2, sag = 0.28, segs = 8, radius = 0.032) {
  let px = x1, py = y1, pz = z1;
  for (let s = 1; s <= segs; s++) {
    const t = s / segs;
    const nx = x1 + (x2 - x1) * t;
    const nz = z1 + (z2 - z1) * t;
    const ny = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * sag;
    appendBeam(geom, px, py, pz, nx, ny, nz, radius, 5);
    px = nx; py = ny; pz = nz;
  }
}

function appendOrganicPuddleDisc(geom, cx, cy, cz, rx, rz, seed = 1, segs = 28) {
  const cIdx = geom.positions.length / 3;
  geom.positions.push(cx, cy, cz);
  geom.normals.push(0, 1, 0);
  geom.uvs.push(0.5, 0.5);
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const wobble = 1.0 + 0.14 * Math.sin(a * 3.0 + seed * 1.7) + 0.08 * Math.cos(a * 5.0 - seed * 2.3);
    const px = cx + Math.cos(a) * rx * wobble;
    const pz = cz + Math.sin(a) * rz * wobble;
    geom.positions.push(px, cy, pz);
    geom.normals.push(0, 1, 0);
    // Keep normalized radial coordinates in [0..1] so the puddle shader can compute exact edge distance r = length(uv - 0.5) * 2.0!
    geom.uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
  }
  for (let i = 0; i < segs; i++) {
    geom.indices.push(cIdx, cIdx + 1 + i + 1, cIdx + 1 + i);
  }
}

// ---------------------------------------------------------------------------
// 3. Build Weapons Pack GLB (public/assets/models/weapons_pack.glb)
//    High-Detail Tactical Weapons matching AGY weapon_carbine_sheet.jpg:
//    - AR-7 Tactical Carbine (M-LOK ventilated handguard, hollow EOTech hood, PEQ-15 laser, trigger guard, dust cover, forward assist, CTR skeleton stock, ribbed PMAG)
//    - SR-9 Bolt-Action Sniper (Fluted barrel, 2-chamber muzzle brake, bolt handle + knob, 8x scope with windage/elevation turrets & scope rings, cheek riser, folding bipod)
//    - RL-7 Anti-Armor Rocket Launcher (Front/rear rubber bumper collars, clamp bands, optical sight assembly, venturi cone, protruding HEAT warhead)
// ---------------------------------------------------------------------------
function buildWeaponsPackGlb() {
  const b = new GlbBuilder();
  const matGunmetal = b.addPbrTextureMaterial('MI_Gunmetal_Anodized', TEX_SETS.gunmetal_pbr, {
    normalScale: 0.35,
    baseColorFactor: [0.52, 0.56, 0.62, 1],
    roughnessFactor: 0.44,
    metallicFactor: 0.90,
  });
  const matDarkSteel = b.addPbrTextureMaterial('MI_Barrel_DarkSteel', TEX_SETS.gunmetal_pbr, {
    normalScale: 0.28,
    baseColorFactor: [0.34, 0.38, 0.44, 1],
    roughnessFactor: 0.36,
    metallicFactor: 0.95,
  });
  const matPolymer = b.addPbrTextureMaterial('MI_Polymer_Grip', TEX_SETS.gunmetal_pbr, {
    normalScale: 0.40,
    baseColorFactor: [0.22, 0.24, 0.27, 1],
    roughnessFactor: 0.92,
    metallicFactor: 0.14,
  });
  const matFdePolymer = b.addPbrTextureMaterial('MI_Polymer_FDE_Accent', TEX_SETS.tactical_camo, {
    normalScale: 0.25,
    baseColorFactor: [1.1, 1.0, 0.82, 1],
    roughnessFactor: 0.95,
    metallicFactor: 0.18,
  });
  const matGlass = b.addSolidPbrMaterial('MI_Optic_Lens', [0.15, 0.72, 0.92, 0.22], 0.05, 0.9, [0.04, 0.18, 0.24], 'BLEND');
  const matReticle = b.addSolidPbrMaterial('MI_Reticle_Red', [1.0, 0.2, 0.1, 1], 0.1, 0.0, [2.8, 0.35, 0.12]);
  const matLaserGreen = b.addSolidPbrMaterial('MI_Laser_Lens_Green', [0.2, 1.0, 0.4, 1], 0.1, 0.0, [0.8, 2.6, 1.1]);
  const matOlive = b.addPbrTextureMaterial('MI_Launcher_Olive', TEX_SETS.tactical_camo, {
    normalScale: 0.3,
    baseColorFactor: [1.35, 1.45, 1.25, 1],
    roughnessFactor: 0.65,
    metallicFactor: 0.38,
  });
  const matBrass = b.addSolidPbrMaterial('MI_Brass_Detail', [0.82, 0.64, 0.26, 1], 0.26, 0.92);

  // --- Weapon 1: AR-7 Tactical Carbine ---
  const arMetal = makeGeometryCollector();
  const arSteel = makeGeometryCollector();
  const arPoly = makeGeometryCollector();
  const arFdePolymer = makeGeometryCollector();
  const arBrass = makeGeometryCollector();
  const arLens = makeGeometryCollector();
  const arRet = makeGeometryCollector();
  const arLaser = makeGeometryCollector();

  // Upper & Lower Forged Receivers with Magwell Flare
  appendBox(arMetal, 0, 0.034, -0.035, 0.044, 0.042, 0.22, 0.8); // Upper Receiver
  appendBox(arMetal, 0, -0.002, -0.025, 0.042, 0.036, 0.19, 0.8); // Lower Receiver
  appendBox(arMetal, 0, -0.024, -0.065, 0.046, 0.024, 0.072, 0.6); // Flared Magwell lip
  // Brass Deflector, Dust Cover, Bolt Carrier Group (visible in port) & Forward Assist
  appendBox(arSteel, 0.023, 0.034, -0.025, 0.004, 0.018, 0.068, 0.5); // Ejection port Bolt Carrier
  appendBox(arPoly, 0.024, 0.022, -0.025, 0.005, 0.012, 0.066, 0.5);  // Open Dust Cover flap
  appendBox(arMetal, 0.025, 0.034, 0.022, 0.012, 0.018, 0.020, 0.5);  // Brass deflector bump
  appendCylinder(arMetal, 0.024, 0.028, 0.055, 0.007, 0.008, 0.032, 10, 'z'); // Forward Assist plunger
  // Ambidextrous Charging Handle & Fire Selector Switch
  appendBox(arMetal, 0, 0.052, 0.082, 0.052, 0.010, 0.026, 0.5); // Charging handle T-latch
  appendBox(arSteel, -0.023, 0.002, 0.032, 0.006, 0.008, 0.024, 0.5); // Fire selector lever
  // Trigger Guard & Curved Trigger
  appendBox(arPoly, 0, -0.028, -0.005, 0.018, 0.006, 0.052, 0.5); // Trigger guard bow
  appendBeam(arSteel, 0, -0.010, 0.002, 0, -0.024, -0.006, 0.0035, 6); // Trigger blade

  // M-LOK Ventilated Free-Float Handguard (slotted octagonal shroud around gas tube + barrel)
  appendBox(arMetal, 0, 0.052, -0.255, 0.036, 0.012, 0.27, 0.8);  // Handguard Top Rail Spine
  appendBox(arMetal, 0, 0.006, -0.255, 0.034, 0.010, 0.27, 0.8);  // Handguard Bottom Spine
  // Left & Right M-LOK Slotted Side Walls (creates genuine see-through ventilation slots!)
  for (const side of [-0.019, 0.019]) {
    appendBox(arMetal, side, 0.041, -0.255, 0.006, 0.012, 0.27, 0.8); // Upper side rail
    appendBox(arMetal, side, 0.017, -0.255, 0.006, 0.012, 0.27, 0.8); // Lower side rail
    for (let z = -0.38; z <= -0.13; z += 0.048) {
      appendBox(arMetal, side, 0.029, z, 0.007, 0.016, 0.016, 0.5); // M-LOK bridge ribs between slots
    }
  }
  // Internal Gas Block, Silver Gas Tube & Heavy Barrel + 3-Prong Flash Hider
  appendCylinder(arSteel, 0, 0.029, -0.33, 0.015, 0.015, 0.032, 12, 'z'); // Low-profile gas block
  appendCylinder(arBrass, 0, 0.042, -0.21, 0.0035, 0.0035, 0.22, 8, 'z'); // Stainless gas tube
  appendCylinder(arSteel, 0, 0.029, -0.34, 0.011, 0.012, 0.42, 16, 'z');  // Match barrel
  appendCylinder(arSteel, 0, 0.029, -0.57, 0.015, 0.014, 0.058, 16, 'z'); // Muzzle compensator collar
  appendBox(arPoly, 0, 0.029, -0.585, 0.008, 0.031, 0.032, 0.5);          // Compensator vent ports

  // Full-length Picatinny Rail Teeth (Upper Receiver + Handguard)
  for (let z = -0.38; z <= 0.065; z += 0.016) {
    appendBox(arMetal, 0, 0.059, z, 0.024, 0.006, 0.008, 0.5);
  }

  // Hollow EOTech Holographic Weapon Sight (with open window frame, side buttons & locking lever)
  appendBox(arMetal, 0, 0.068, -0.03, 0.042, 0.014, 0.076, 0.5);    // Sight base clamp
  appendBox(arMetal, -0.020, 0.092, -0.03, 0.006, 0.038, 0.056, 0.5); // Left protective hood wall
  appendBox(arMetal, 0.020, 0.092, -0.03, 0.006, 0.038, 0.056, 0.5);  // Right protective hood wall
  appendBox(arMetal, 0, 0.110, -0.03, 0.046, 0.006, 0.058, 0.5);     // Top protective hood arch
  appendCylinder(arPoly, 0.024, 0.082, -0.025, 0.006, 0.006, 0.006, 10, 'x'); // Windage turret button
  appendBox(arLens, 0, 0.092, -0.03, 0.034, 0.030, 0.003, 0.5);      // Anti-reflective glass window
  appendBox(arRet, 0, 0.092, -0.033, 0.004, 0.004, 0.002, 0.5);      // Glowing Holo Red Dot

  // Top-Mounted PEQ-15 Tactical Laser Module & Flip-Up Backup Iron Sights (MBUS)
  appendBox(arPoly, 0, 0.070, -0.32, 0.042, 0.018, 0.068, 0.5);
  appendCylinder(arLaser, 0.012, 0.070, -0.356, 0.004, 0.004, 0.004, 10, 'z'); // Green laser emitter lens
  appendBox(arPoly, 0, 0.068, -0.375, 0.028, 0.016, 0.022, 0.5); // Folded Front MBUS Sight
  appendBox(arPoly, 0, 0.068, 0.052, 0.030, 0.016, 0.026, 0.5);  // Folded Rear MBUS Sight
  appendCylinder(arSteel, -0.024, 0.026, 0.088, 0.008, 0.008, 0.006, 10, 'x'); // QD Sling Swivel Socket

  // Skeletonized CTR Tactical Buttstock, Buffer Tube, Ergonomic Pistol Grip, Vertical Foregrip & Ribbed PMAG
  appendCylinder(arMetal, 0, 0.028, 0.16, 0.016, 0.016, 0.18, 12, 'z'); // Mil-spec buffer tube
  appendBox(arPoly, 0, 0.032, 0.185, 0.040, 0.032, 0.17, 0.6);          // Stock cheek weld comb
  appendBox(arPoly, 0, -0.012, 0.258, 0.044, 0.118, 0.024, 0.6);        // Rubber recoil buttpad
  appendBeam(arPoly, 0, -0.052, 0.248, 0, 0.018, 0.115, 0.012, 8);      // Skeletonized diagonal strut
  // Ergonomic Angled Pistol Grip (raked backward at 18 deg)
  appendBeam(arPoly, 0, -0.012, 0.025, 0, -0.095, 0.058, 0.019, 10);
  appendBox(arPoly, 0, -0.055, 0.042, 0.030, 0.088, 0.038, 0.6);
  // Textured Vertical Foregrip with locking collar
  appendBox(arMetal, 0, -0.004, -0.25, 0.032, 0.014, 0.044, 0.5);
  appendCylinder(arPoly, 0, -0.048, -0.25, 0.016, 0.014, 0.084, 14, 'y');
  // 30-Round Polymer PMAG with grip ribs & floorplate
  appendBox(arPoly, 0, -0.078, -0.065, 0.026, 0.125, 0.056, 0.6);
  appendBox(arPoly, 0, -0.145, -0.076, 0.028, 0.042, 0.058, 0.6);
  appendBox(arFdePolymer, 0, -0.168, -0.078, 0.032, 0.010, 0.064, 0.5); // Magazine bumper plate
  for (let yRib = -0.045; yRib >= -0.125; yRib -= 0.022) {
    appendBox(arPoly, 0, yRib, -0.065, 0.030, 0.006, 0.058, 0.5); // PMAG horizontal ribs
  }

  const arNode = b.addNode('AR7_Carbine', [
    b.addMeshPrimitive('AR7_Metal', arMetal.positions, arMetal.normals, arMetal.uvs, arMetal.indices, matGunmetal),
    b.addMeshPrimitive('AR7_Steel', arSteel.positions, arSteel.normals, arSteel.uvs, arSteel.indices, matDarkSteel),
    b.addMeshPrimitive('AR7_Polymer', arPoly.positions, arPoly.normals, arPoly.uvs, arPoly.indices, matPolymer),
    b.addMeshPrimitive('AR7_FDE', arFdePolymer.positions, arFdePolymer.normals, arFdePolymer.uvs, arFdePolymer.indices, matFdePolymer),
    b.addMeshPrimitive('AR7_Brass', arBrass.positions, arBrass.normals, arBrass.uvs, arBrass.indices, matBrass),
    b.addMeshPrimitive('AR7_Lens', arLens.positions, arLens.normals, arLens.uvs, arLens.indices, matGlass),
    b.addMeshPrimitive('AR7_Reticle', arRet.positions, arRet.normals, arRet.uvs, arRet.indices, matReticle),
    b.addMeshPrimitive('AR7_Laser', arLaser.positions, arLaser.normals, arLaser.uvs, arLaser.indices, matLaserGreen),
  ]);

  // --- Weapon 2: SR-9 Bolt-Action Sniper Rifle ---
  const srMetal = makeGeometryCollector();
  const srSteel = makeGeometryCollector();
  const srPoly = makeGeometryCollector();
  const srFdePolymer = makeGeometryCollector();
  const srLens = makeGeometryCollector();
  const srBrass = makeGeometryCollector();

  // CNC Machined Tactical Chassis & Ventilated Forend
  appendBox(srMetal, 0, 0.022, -0.08, 0.044, 0.052, 0.38, 0.8); // Main chassis block
  appendBox(srMetal, 0, 0.016, -0.34, 0.040, 0.036, 0.22, 0.8); // Forend chassis extension
  for (let z = -0.41; z <= -0.26; z += 0.045) {
    appendBox(srSteel, 0, 0.020, z, 0.044, 0.014, 0.022, 0.5); // Forend keymod/ventilation slots
  }
  // Bolt Handle & Spherical Tactical Bolt Knob (Right side)
  appendCylinder(srSteel, 0.012, 0.032, -0.02, 0.010, 0.010, 0.14, 12, 'z'); // Fluted bolt body
  appendBeam(srSteel, 0.018, 0.032, 0.025, 0.052, 0.014, 0.035, 0.005, 8);   // Swept bolt handle
  appendCylinder(srPoly, 0.054, 0.012, 0.036, 0.011, 0.009, 0.018, 10, 'x'); // Oversized tactical bolt knob
  // Trigger Guard & Match Trigger
  appendBox(srPoly, 0, -0.024, 0.005, 0.018, 0.006, 0.052, 0.5);
  appendBeam(srBrass, 0, -0.006, 0.012, 0, -0.020, 0.006, 0.0035, 6); // Gold match trigger

  // Long Free-Floated Heavy Fluted Barrel & 2-Chamber Tanker Muzzle Brake
  appendCylinder(srSteel, 0, 0.034, -0.48, 0.012, 0.016, 0.58, 16, 'z');
  for (const fx of [-0.013, 0.013]) {
    appendBox(srMetal, fx, 0.034, -0.52, 0.003, 0.006, 0.36, 0.5); // Barrel longitudinal fluting ribs
  }
  appendBox(srSteel, 0, 0.034, -0.79, 0.032, 0.026, 0.072, 0.5); // Muzzle brake body
  appendBox(srPoly, 0, 0.034, -0.775, 0.035, 0.014, 0.016, 0.5); // Brake baffle port 1
  appendBox(srPoly, 0, 0.034, -0.802, 0.035, 0.014, 0.016, 0.5); // Brake baffle port 2

  // 8x50mm Precision Telescopic Scope + Dual Cantilever Scope Rings + Elevation/Windage Turrets
  appendBox(srMetal, 0, 0.068, -0.12, 0.034, 0.036, 0.024, 0.5); // Front scope ring mount
  appendBox(srMetal, 0, 0.068, 0.02, 0.034, 0.036, 0.024, 0.5);  // Rear scope ring mount
  appendCylinder(srMetal, 0, 0.092, -0.05, 0.016, 0.016, 0.26, 16, 'z'); // Scope main tube
  appendCylinder(srMetal, 0, 0.092, -0.21, 0.028, 0.017, 0.09, 16, 'z'); // 50mm Front objective bell
  appendCylinder(srMetal, 0, 0.092, -0.265, 0.029, 0.028, 0.035, 16, 'z'); // Sunshade hood
  appendCylinder(srMetal, 0, 0.092, 0.095, 0.021, 0.023, 0.065, 16, 'z'); // Rear ocular bell
  // Target Turrets (Top Elevation, Right Windage, Left Parallax) + Brass zero-stop ring
  appendCylinder(srPoly, 0, 0.116, -0.05, 0.013, 0.013, 0.022, 12, 'y');
  appendCylinder(srBrass, 0, 0.106, -0.05, 0.014, 0.014, 0.004, 12, 'y');
  appendCylinder(srPoly, 0.024, 0.092, -0.05, 0.012, 0.012, 0.018, 12, 'x');
  appendCylinder(srPoly, -0.024, 0.092, -0.05, 0.011, 0.011, 0.016, 12, 'x');
  appendCylinder(srLens, 0, 0.092, 0.129, 0.019, 0.019, 0.004, 16, 'z');
  appendCylinder(srLens, 0, 0.092, -0.281, 0.026, 0.026, 0.004, 16, 'z');

  // Folding Spring Bipod with Notched Legs & Rubber Feet
  appendBox(srMetal, 0, -0.006, -0.41, 0.048, 0.018, 0.036, 0.5); // Bipod swivel block
  for (const bx of [-0.036, 0.036]) {
    appendBeam(srSteel, bx * 0.6, -0.01, -0.41, bx * 1.25, -0.12, -0.43, 0.0065, 8);
    appendCylinder(srPoly, bx * 1.25, -0.125, -0.43, 0.011, 0.013, 0.018, 10, 'y'); // Bipod foot pad
  }

  // Precision Skeletonized Sniper Stock with Adjustable Cheek Riser Posts & .338 Lapua Box Mag
  appendBox(srPoly, 0, 0.018, 0.19, 0.036, 0.028, 0.22, 0.6); // Upper stock beam
  appendBox(srPoly, 0, -0.028, 0.20, 0.034, 0.022, 0.20, 0.6); // Lower stock hook beam
  appendBox(srPoly, 0, -0.005, 0.295, 0.042, 0.115, 0.032, 0.6); // Adjustable recoil pad
  appendCylinder(srSteel, 0, 0.038, 0.16, 0.005, 0.005, 0.03, 8, 'y'); // Cheek riser post 1
  appendCylinder(srSteel, 0, 0.038, 0.23, 0.005, 0.005, 0.03, 8, 'y'); // Cheek riser post 2
  appendBox(srFdePolymer, 0, 0.052, 0.195, 0.042, 0.022, 0.125, 0.5); // Molded Cheek Rest
  appendBeam(srPoly, 0, -0.01, 0.045, 0, -0.095, 0.068, 0.019, 10);    // Vertical precision grip
  appendBox(srSteel, 0, -0.052, -0.075, 0.030, 0.092, 0.086, 0.6);     // .338 Box Magazine
  appendBox(srPoly, 0, -0.098, -0.075, 0.034, 0.012, 0.090, 0.5);      // Mag baseplate

  const srNode = b.addNode('SR9_Sniper', [
    b.addMeshPrimitive('SR9_Metal', srMetal.positions, srMetal.normals, srMetal.uvs, srMetal.indices, matGunmetal),
    b.addMeshPrimitive('SR9_Steel', srSteel.positions, srSteel.normals, srSteel.uvs, srSteel.indices, matDarkSteel),
    b.addMeshPrimitive('SR9_Polymer', srPoly.positions, srPoly.normals, srPoly.uvs, srPoly.indices, matPolymer),
    b.addMeshPrimitive('SR9_FDE', srFdePolymer.positions, srFdePolymer.normals, srFdePolymer.uvs, srFdePolymer.indices, matFdePolymer),
    b.addMeshPrimitive('SR9_Brass', srBrass.positions, srBrass.normals, srBrass.uvs, srBrass.indices, matBrass),
    b.addMeshPrimitive('SR9_Lens', srLens.positions, srLens.normals, srLens.uvs, srLens.indices, matGlass),
  ]);

  // --- Weapon 3: RL-7 Anti-Armor Rocket Launcher ---
  const rlBody = makeGeometryCollector();
  const rlMetal = makeGeometryCollector();
  const rlPoly = makeGeometryCollector();
  const rlWarhead = makeGeometryCollector();
  const rlLens = makeGeometryCollector();

  appendCylinder(rlBody, 0, 0.04, -0.08, 0.056, 0.056, 0.78, 20, 'z'); // Fiberglass Olive Launch Tube
  // Structural Reinforcement Clamp Bands & Ribbing along Launch Tube
  for (const bz of [-0.36, -0.18, 0.02, 0.18]) {
    appendCylinder(rlMetal, 0, 0.04, bz, 0.060, 0.060, 0.024, 20, 'z');
  }
  appendCylinder(rlPoly, 0, 0.04, -0.49, 0.074, 0.064, 0.075, 20, 'z'); // Front heavy rubber bumper collar
  appendCylinder(rlMetal, 0, 0.04, 0.34, 0.058, 0.084, 0.11, 20, 'z');  // Rear Venturi exhaust nozzle
  appendCylinder(rlPoly, 0, 0.04, 0.40, 0.086, 0.082, 0.028, 20, 'z');  // Rear bumper ring
  // Top Carrying Handle & Foam Shoulder Rest
  appendBeam(rlMetal, 0, 0.106, -0.16, 0, 0.106, 0.04, 0.008, 8);
  appendBox(rlMetal, 0, 0.095, -0.16, 0.016, 0.024, 0.02, 0.5);
  appendBox(rlMetal, 0, 0.095, 0.04, 0.016, 0.024, 0.02, 0.5);
  appendBox(rlPoly, 0, 0.012, 0.12, 0.122, 0.068, 0.18, 0.5); // Padded shoulder rest cradle
  // Side Optical Sight Assembly & Lens
  appendBox(rlMetal, -0.066, 0.068, -0.14, 0.028, 0.022, 0.08, 0.5);
  appendCylinder(rlMetal, -0.075, 0.086, -0.14, 0.016, 0.016, 0.095, 14, 'z');
  appendCylinder(rlLens, -0.075, 0.086, -0.189, 0.014, 0.014, 0.004, 14, 'z');
  // Dual Firing & Foregrips with Trigger Guard
  appendBeam(rlPoly, 0, -0.01, -0.04, 0, -0.095, -0.02, 0.018, 10);
  appendBox(rlMetal, 0, -0.035, -0.065, 0.018, 0.006, 0.048, 0.5);
  appendBeam(rlPoly, 0, -0.01, -0.26, 0, -0.092, -0.25, 0.017, 10);
  // Protruding Tandem HEAT Warhead Cone + Piezo Nose Fuse
  appendCylinder(rlWarhead, 0, 0.04, -0.55, 0.018, 0.052, 0.11, 16, 'z');
  appendCylinder(rlMetal, 0, 0.04, -0.62, 0.008, 0.014, 0.045, 12, 'z');

  const rlNode = b.addNode('RL7_Launcher', [
    b.addMeshPrimitive('RL7_Tube', rlBody.positions, rlBody.normals, rlBody.uvs, rlBody.indices, matOlive),
    b.addMeshPrimitive('RL7_Hardware', rlMetal.positions, rlMetal.normals, rlMetal.uvs, rlMetal.indices, matGunmetal),
    b.addMeshPrimitive('RL7_Polymer', rlPoly.positions, rlPoly.normals, rlPoly.uvs, rlPoly.indices, matPolymer),
    b.addMeshPrimitive('RL7_Warhead', rlWarhead.positions, rlWarhead.normals, rlWarhead.uvs, rlWarhead.indices, matBrass),
    b.addMeshPrimitive('RL7_Lens', rlLens.positions, rlLens.normals, rlLens.uvs, rlLens.indices, matGlass),
  ]);

  // --- Weapon 4: SMG-9 Suppressed Tactical Submachine Gun ---
  const smgMetal = makeGeometryCollector();
  const smgSteel = makeGeometryCollector();
  const smgPoly = makeGeometryCollector();
  const smgBrass = makeGeometryCollector();
  const smgLens = makeGeometryCollector();
  const smgRet = makeGeometryCollector();
  const smgLaser = makeGeometryCollector();

  // Compact CNC Upper/Lower Receiver & Flared 9mm Magwell
  appendBox(smgMetal, 0, 0.032, -0.02, 0.038, 0.044, 0.21, 0.8);
  appendBox(smgPoly, 0, -0.004, -0.015, 0.036, 0.034, 0.18, 0.8);
  // Ejection port, brass bolt carrier, non-reciprocating charging handle & trigger guard
  appendBox(smgBrass, 0.020, 0.032, -0.025, 0.005, 0.016, 0.052, 0.5);
  appendBox(smgBrass, 0, -0.176, -0.088, 0.024, 0.008, 0.038, 0.5); // Brass Magazine Floorplate
  appendCylinder(smgSteel, -0.022, 0.042, -0.14, 0.006, 0.006, 0.024, 10, 'x'); // MP5-style cocking handle
  appendBox(smgPoly, 0, -0.028, 0.008, 0.016, 0.005, 0.044, 0.5); // Trigger guard
  appendBeam(smgBrass, 0, -0.010, 0.014, 0, -0.024, 0.008, 0.0035, 6); // Match trigger blade
  // Ventilated M-LOK Quad-Rail Forend
  appendBox(smgMetal, 0, 0.042, -0.175, 0.034, 0.032, 0.14, 0.8);
  for (let z = -0.22; z <= -0.13; z += 0.03) {
    appendBox(smgSteel, 0, 0.042, z, 0.036, 0.012, 0.014, 0.5); // Forend vent slots
  }
  for (let z = -0.23; z <= 0.06; z += 0.016) {
    appendBox(smgMetal, 0, 0.056, z, 0.022, 0.005, 0.008, 0.5); // Top Picatinny Rail
  }
  // Integrated Knurled cylindrical Sound Suppressor (Silencer)
  appendCylinder(smgSteel, 0, 0.032, -0.34, 0.019, 0.019, 0.22, 16, 'z');
  for (const sz of [-0.26, -0.30, -0.34, -0.38, -0.42]) {
    appendCylinder(smgMetal, 0, 0.032, sz, 0.0208, 0.0208, 0.012, 16, 'z'); // Suppressor heat-dissipation rings
  }
  // Trijicon RMR Micro Reflex Sight on Riser Mount
  appendBox(smgMetal, 0, 0.066, -0.02, 0.030, 0.016, 0.044, 0.5);
  appendBox(smgMetal, -0.014, 0.084, -0.02, 0.004, 0.024, 0.032, 0.5);
  appendBox(smgMetal, 0.014, 0.084, -0.02, 0.004, 0.024, 0.032, 0.5);
  appendBox(smgLens, 0, 0.084, -0.02, 0.024, 0.020, 0.003, 0.5);
  appendBox(smgRet, 0, 0.084, -0.022, 0.0035, 0.0035, 0.002, 0.5);
  // Side-Mounted Tactical Green Laser Pointer Module
  appendBox(smgPoly, 0.024, 0.032, -0.19, 0.016, 0.020, 0.055, 0.5);
  appendCylinder(smgLaser, 0.024, 0.032, -0.22, 0.0045, 0.0045, 0.006, 10, 'z');
  // Dual-Bar Skeleton Folding Stock & Ergonomic Grip + Stubby Foregrip + Extended 45-rd Curved 9mm Mag
  appendBeam(smgSteel, -0.012, 0.036, 0.08, -0.012, 0.028, 0.24, 0.005, 8);
  appendBeam(smgSteel, 0.012, 0.014, 0.08, 0.012, 0.006, 0.24, 0.005, 8);
  appendBox(smgPoly, 0, 0.012, 0.245, 0.034, 0.095, 0.020, 0.5);
  appendBeam(smgPoly, 0, -0.01, 0.035, 0, -0.092, 0.062, 0.018, 10); // Pistol grip
  appendCylinder(smgPoly, 0, -0.042, -0.20, 0.014, 0.013, 0.068, 12, 'y'); // Stubby vertical foregrip
  appendBeam(smgPoly, 0, -0.02, -0.065, 0, -0.175, -0.095, 0.014, 8); // Extended 45-rd curved mag
  appendBox(smgPoly, 0, -0.095, -0.078, 0.022, 0.155, 0.034, 0.5);
  for (let yRib = -0.045; yRib >= -0.145; yRib -= 0.025) {
    appendBox(smgSteel, 0, yRib, -0.078, 0.025, 0.005, 0.036, 0.5); // Mag witness window ribs
  }

  const smgNode = b.addNode('SMG9_Tactical', [
    b.addMeshPrimitive('SMG9_Metal', smgMetal.positions, smgMetal.normals, smgMetal.uvs, smgMetal.indices, matGunmetal),
    b.addMeshPrimitive('SMG9_Steel', smgSteel.positions, smgSteel.normals, smgSteel.uvs, smgSteel.indices, matDarkSteel),
    b.addMeshPrimitive('SMG9_Polymer', smgPoly.positions, smgPoly.normals, smgPoly.uvs, smgPoly.indices, matPolymer),
    b.addMeshPrimitive('SMG9_Brass', smgBrass.positions, smgBrass.normals, smgBrass.uvs, smgBrass.indices, matBrass),
    b.addMeshPrimitive('SMG9_Lens', smgLens.positions, smgLens.normals, smgLens.uvs, smgLens.indices, matGlass),
    b.addMeshPrimitive('SMG9_Reticle', smgRet.positions, smgRet.normals, smgRet.uvs, smgRet.indices, matReticle),
    b.addMeshPrimitive('SMG9_Laser', smgLaser.positions, smgLaser.normals, smgLaser.uvs, smgLaser.indices, matLaserGreen),
  ]);

  // --- Weapon 5: SG-12 Tactical Semi-Auto Breacher Shotgun ---
  const sgMetal = makeGeometryCollector();
  const sgSteel = makeGeometryCollector();
  const sgPoly = makeGeometryCollector();
  const sgShells = makeGeometryCollector();
  const sgBrass = makeGeometryCollector();

  // Heavy Combat Receiver & Top Picatinny Rail + Ghost Ring Sight
  appendBox(sgMetal, 0, 0.030, -0.02, 0.042, 0.048, 0.24, 0.8);
  appendBox(sgSteel, 0.022, 0.032, -0.03, 0.004, 0.018, 0.075, 0.5); // Silver bolt carrier in ejection port
  appendCylinder(sgBrass, 0.030, 0.032, -0.05, 0.005, 0.005, 0.018, 10, 'x'); // Oversized bolt handle
  appendBox(sgPoly, 0, -0.018, 0.025, 0.018, 0.006, 0.048, 0.5); // Trigger guard
  appendBeam(sgBrass, 0, -0.002, 0.032, 0, -0.015, 0.025, 0.0035, 6); // Trigger
  for (let z = -0.11; z <= 0.06; z += 0.018) {
    appendBox(sgMetal, 0, 0.056, z, 0.022, 0.005, 0.009, 0.5); // Receiver top Picatinny rail
  }
  appendBox(sgMetal, 0, 0.062, 0.075, 0.026, 0.016, 0.024, 0.5);      // Ghost ring rear aperture
  appendBox(sgMetal, 0, 0.060, -0.55, 0.012, 0.022, 0.018, 0.5);      // High-profile front blade sight
  // 18.5" Heavy Breacher Barrel + Ventilated Top Heat Shield + Full-Length Under-Barrel Tube Magazine
  appendCylinder(sgSteel, 0, 0.042, -0.35, 0.0135, 0.0145, 0.48, 16, 'z'); // Upper shotgun barrel
  for (let z = -0.44; z <= -0.16; z += 0.035) {
    appendBox(sgMetal, 0, 0.053, z, 0.030, 0.008, 0.020, 0.5); // Ventilated barrel heat shield ribs
  }
  appendCylinder(sgMetal, 0, 0.014, -0.33, 0.0125, 0.0125, 0.44, 16, 'z'); // Lower 8-shell tube magazine
  appendBox(sgMetal, 0, 0.028, -0.48, 0.030, 0.038, 0.024, 0.5);           // Barrel/Mag clamp bracket
  appendCylinder(sgSteel, 0, 0.042, -0.60, 0.016, 0.015, 0.045, 14, 'z');  // Stand-off toothed Door Breacher Choke
  // Ribbed Polymer Pump/Forend Action & Tactical Pistol Grip Stock
  appendCylinder(sgPoly, 0, 0.012, -0.26, 0.022, 0.022, 0.19, 14, 'z');
  for (let z = -0.33; z <= -0.19; z += 0.024) {
    appendCylinder(sgPoly, 0, 0.012, z, 0.024, 0.024, 0.008, 14, 'z'); // Forend grip ribs
  }
  appendBeam(sgPoly, 0, -0.008, 0.06, 0, -0.092, 0.088, 0.019, 10); // Pistol grip
  appendBox(sgPoly, 0, 0.014, 0.20, 0.038, 0.042, 0.22, 0.6);       // Fixed tactical stock comb
  appendBox(sgPoly, 0, -0.012, 0.29, 0.042, 0.115, 0.028, 0.6);     // Heavy rubber recoil pad
  appendBeam(sgPoly, 0, -0.055, 0.28, 0, 0.005, 0.11, 0.014, 8);
  // Side-Saddle 6-Shell Carrier with Red 12-Gauge Buckshot Shells & Brass Bases!
  appendBox(sgPoly, -0.023, 0.028, -0.02, 0.008, 0.038, 0.15, 0.5);
  for (let i = 0; i < 6; i++) {
    const sz = -0.075 + i * 0.022;
    appendCylinder(sgShells, -0.028, 0.030, sz, 0.008, 0.008, 0.046, 10, 'y'); // Red 12ga hull
    appendCylinder(sgBrass, -0.028, 0.054, sz, 0.0085, 0.0085, 0.010, 10, 'y'); // Brass rim
  }

  const sgNode = b.addNode('SG12_Shotgun', [
    b.addMeshPrimitive('SG12_Metal', sgMetal.positions, sgMetal.normals, sgMetal.uvs, sgMetal.indices, matGunmetal),
    b.addMeshPrimitive('SG12_Steel', sgSteel.positions, sgSteel.normals, sgSteel.uvs, sgSteel.indices, matDarkSteel),
    b.addMeshPrimitive('SG12_Polymer', sgPoly.positions, sgPoly.normals, sgPoly.uvs, sgPoly.indices, matPolymer),
    b.addMeshPrimitive('SG12_Shells', sgShells.positions, sgShells.normals, sgShells.uvs, sgShells.indices, matReticle),
    b.addMeshPrimitive('SG12_Brass', sgBrass.positions, sgBrass.normals, sgBrass.uvs, sgBrass.indices, matBrass),
  ]);

  b.RootNodes.push(arNode, srNode, rlNode, smgNode, sgNode);
  fs.writeFileSync(path.join(OUT_MODELS, 'weapons_pack.glb'), b.toGlbBuffer());
  console.log('Saved public/assets/models/weapons_pack.glb (5 Tactical Weapons)');
}

// ---------------------------------------------------------------------------
// 4. Build Night Port Environment GLB (public/assets/models/port_environment.glb)
// ---------------------------------------------------------------------------
function buildPortEnvironmentGlb() {
  const b = new GlbBuilder();
  const matConcrete = b.addPbrTextureMaterial('MI_Dock_WetConcrete', TEX_SETS.wet_concrete);
  const matContRed = b.addPbrTextureMaterial('MI_Container_Red', TEX_SETS.container_red);
  const matContBlue = b.addPbrTextureMaterial('MI_Container_Blue', TEX_SETS.container_blue);
  const matContGreen = b.addPbrTextureMaterial('MI_Container_Green', TEX_SETS.container_green);
  const matRustedSteel = b.addPbrTextureMaterial('MI_Rusted_Steel', TEX_SETS.rusted_steel);
  const matGunmetal = b.addPbrTextureMaterial('MI_Dark_Steel', TEX_SETS.gunmetal_pbr);

  const matPuddle = b.addSolidPbrMaterial('MI_Water_Puddle', [0.06, 0.10, 0.15, 1], 0.02, 0.92);
  const matSea = b.addSolidPbrMaterial('MI_Harbor_Sea', [0.02, 0.05, 0.09, 1], 0.08, 0.72);
  const matShipRed = b.addSolidPbrMaterial('MI_Ship_Waterline', [0.36, 0.11, 0.09, 1], 0.62, 0.35);
  const matShipBridge = b.addPbrTextureMaterial('MI_Ship_Superstructure', TEX_SETS.gunmetal_pbr, {
    baseColorFactor: [0.76, 0.80, 0.85, 1],
    roughnessFactor: 0.68,
    metallicFactor: 0.32,
  });
  const matLitWindow = b.addSolidPbrMaterial('MI_Warm_Window_Emissive', [1.0, 0.82, 0.48, 1], 0.2, 0.0, [2.4, 1.55, 0.68]);
  const matFloodlight = b.addSolidPbrMaterial('MI_Sodium_Lamp', [1.0, 0.75, 0.35, 1], 0.1, 0.0, [3.2, 1.9, 0.65]);
  const matFireGlow = b.addSolidPbrMaterial('MI_Fire_Embers', [1.0, 0.42, 0.08, 1], 0.2, 0.0, [3.5, 1.1, 0.18]);
  const matHazard = b.addSolidPbrMaterial('MI_Hazard_Yellow', [0.78, 0.54, 0.08, 1], 0.48, 0.28);
  const matWood = b.addPbrTextureMaterial('MI_Wood_Crate', TEX_SETS.wood_crate);
  const matExplosive = b.addPbrTextureMaterial('MI_Explosive_Red', TEX_SETS.rusted_steel, {
    baseColorFactor: [1.35, 0.24, 0.18, 1],
    roughnessFactor: 0.72,
    metallicFactor: 0.65,
  });
  const matOliveVehicle = b.addPbrTextureMaterial('MI_Tactical_Vehicle_OD', TEX_SETS.tactical_camo);
  const matRubber = b.addSolidPbrMaterial('MI_Tire_Rubber', [0.06, 0.07, 0.08, 1], 0.84, 0.08);

  const gConcrete = makeGeometryCollector();
  const gPuddles = makeGeometryCollector();
  const gSea = makeGeometryCollector();
  const gContRed = makeGeometryCollector();
  const gContBlue = makeGeometryCollector();
  const gContGreen = makeGeometryCollector();
  const gSteel = makeGeometryCollector();
  const gDarkSteel = makeGeometryCollector();
  const gShipRed = makeGeometryCollector();
  const gShipBridge = makeGeometryCollector();
  const gWindows = makeGeometryCollector();
  const gLamps = makeGeometryCollector();
  const gFire = makeGeometryCollector();
  const gHazard = makeGeometryCollector();
  const gWood = makeGeometryCollector();
  const gExplosive = makeGeometryCollector();
  const gVehicleOD = makeGeometryCollector();
  const gRubber = makeGeometryCollector();

  // 1. Main Concrete Dock Platform & Sea Basin + Southern Dock Edge
  appendBox(gConcrete, 4, -1.0, 0, 56, 2.0, 88, 0.18);
  appendBox(gSea, -42, -1.6, 0, 60, 0.4, 120, 0.08);
  // Seawall Coping & Yellow Hazard Stripes & Mooring Bollards + Hanging Bollard Chains
  appendBox(gConcrete, -23.5, 0.18, 0, 1.2, 0.36, 86, 0.25);
  appendBox(gHazard, -22.75, 0.015, 0, 0.18, 0.018, 82, 0.5); // Continuous yellow quay safety line!
  for (let z = -38; z <= 38; z += 4) {
    appendBox(gHazard, -23.1, 0.37, z, 0.35, 0.02, 1.8, 1);
    // Rubber Cylindrical Dock Fenders along Quay Wall
    appendCylinder(gRubber, -24.18, -0.1, z, 0.32, 0.32, 1.4, 10, 'y');
  }
  const westBollardZs = [];
  for (let z = -34; z <= 34; z += 6.8) {
    westBollardZs.push(z);
    appendCylinder(gDarkSteel, -23.3, 0.55, z, 0.26, 0.32, 0.75, 12, 'y');
    appendCylinder(gDarkSteel, -23.3, 0.92, z, 0.36, 0.36, 0.12, 12, 'y');
  }
  for (let i = 0; i < westBollardZs.length - 1; i++) {
    appendCatenaryChain(gDarkSteel, -23.3, 0.78, westBollardZs[i], -23.3, 0.78, westBollardZs[i + 1], 0.32, 7, 0.035);
  }
  // Connect last west bollard (z=34) to first south bollard (-20, 29.8) so foreground corner chain is continuous!
  appendCatenaryChain(gDarkSteel, -23.3, 0.78, 27.2, -20.0, 0.74, 29.8, 0.28, 7, 0.036);
  // Foreground Southern Seawall Bollards & Heavy Chains (matching CAM_HERO bottom foreground!)
  const southBollardXs = [-20, -13, -6, 1, 8];
  appendBox(gConcrete, -6, 0.16, 29.8, 32, 0.32, 0.95, 0.25);
  for (let i = 0; i < southBollardXs.length; i++) {
    const bx = southBollardXs[i];
    appendCylinder(gDarkSteel, bx, 0.52, 29.8, 0.25, 0.31, 0.72, 12, 'y');
    appendCylinder(gDarkSteel, bx, 0.88, 29.8, 0.35, 0.35, 0.11, 12, 'y');
    if (i < southBollardXs.length - 1) {
      appendCatenaryChain(gDarkSteel, bx, 0.74, 29.8, southBollardXs[i + 1], 0.74, 29.8, 0.28, 7, 0.035);
    }
  }

  // Crane railway tracks along west lane
  appendBox(gDarkSteel, -11.5, 0.03, 0, 0.22, 0.07, 78, 0.5);
  appendBox(gDarkSteel, -3.5, 0.03, 0, 0.22, 0.07, 78, 0.5);

  // Reflective Wet Puddle Patches across dock lanes (Organic irregular polygons with radial UVs for feathering!)
  const puddles = [
    [-6.5, 22.0, 3.1, 4.5], [-3.2, 25.0, 2.5, 2.9], [-5.2, 8.2, 2.7, 5.1],
    [-7.5, -12.0, 2.8, 4.8], [2.5, 16.0, 3.2, 4.0], [8.5, -4.0, 2.9, 4.4],
    [14.2, 18.5, 2.9, 3.6], [16.5, 9.5, 3.0, 4.0],
  ];
  puddles.forEach(([px, pz, rx, rz], idx) => {
    appendOrganicPuddleDisc(gPuddles, px, 0.014, pz, rx, rz, idx + 1, 28);
  });

  // 2. Moored Cargo Ship ("MV ATLANTIC MARINER") along West Quay (x = -33, z = -44..+16)
  //    Calibrated so Raked Bow (z = +8..+16), 3-Tier Container Deck (z = -24..+6), and Stern Bridge (z = -35) are all framed in CAM_HERO & CAM_LANE!
  appendBox(gShipRed, -33, -0.2, -16, 15.5, 2.8, 56, 0.12); // Lower waterline hull
  appendBox(gSteel, -33, 3.8, -16, 16.0, 5.6, 58, 0.14); // Main rusted hull
  // Hull structural rib strakes, bulwark rail, draft marks & raised hull nameplate
  appendBox(gDarkSteel, -24.9, 6.65, -16, 0.35, 0.45, 58, 0.25);
  appendBox(gDarkSteel, -24.95, 2.2, -16, 0.25, 0.3, 56, 0.25);
  appendBox(gShipBridge, -25.1, 5.6, 10.5, 0.14, 0.62, 4.6, 0.5); // Raised white hull nameplate plaque near bow
  for (let dy = 0.2; dy <= 2.2; dy += 0.45) {
    appendBox(gShipBridge, -25.15, dy, 8.5, 0.12, 0.14, 0.55, 0.5); // Hull draft waterline scale marks
  }
  // Raked Bow Forecastle + Tapered Prow + Mast & Bow Floodlight (z = +9..+17, clearly visible in CAM_HERO!)
  appendBox(gSteel, -33, 5.4, 10.5, 12.6, 6.4, 8.0, 0.15);
  appendBox(gSteel, -33, 5.8, 14.5, 7.8, 6.6, 5.2, 0.15);
  appendBox(gSteel, -33, 6.2, 17.2, 3.6, 6.8, 3.4, 0.15);
  appendCylinder(gDarkSteel, -33, 12.2, 15.0, 0.16, 0.28, 6.8, 10, 'y'); // Foremast
  appendBox(gDarkSteel, -33, 13.8, 15.0, 2.6, 0.18, 0.18, 1); // Foremast yardarm
  appendBox(gLamps, -33, 15.2, 15.0, 0.65, 0.45, 0.65, 1); // Bow mast beacon
  // Heavy Mooring Hawsers (Ropes from Ship Bow/Midship/Stern to Quay Bollards)
  appendCatenaryChain(gDarkSteel, -27.2, 6.2, 14.0, -23.3, 0.85, 17.0, 0.85, 8, 0.045);
  appendCatenaryChain(gDarkSteel, -27.2, 6.2, 4.0, -23.3, 0.85, 8.5, 0.75, 8, 0.045);
  appendCatenaryChain(gDarkSteel, -25.2, 5.8, -16.0, -23.3, 0.85, -17.0, 0.65, 8, 0.045);

  // Ship Deck Cargo Containers (Multi-stack 3 tiers of Red/Green/Blue containers matching CAM_HERO & CAM_LANE!)
  appendBox(gContRed, -35.5, 7.9, -18, 3.2, 2.6, 11, 0.25);
  appendBox(gContBlue, -30.5, 7.9, -18, 3.2, 2.6, 11, 0.25);
  appendBox(gContGreen, -35.5, 10.5, -18, 3.2, 2.6, 11, 0.25);
  appendBox(gContRed, -30.5, 10.5, -18, 3.2, 2.6, 11, 0.25);
  appendBox(gContBlue, -33.0, 13.1, -18, 3.2, 2.6, 11, 0.25);
  appendBox(gContRed, -30.5, 7.9, -5, 3.2, 2.6, 11, 0.25);
  appendBox(gContBlue, -35.5, 7.9, -5, 3.2, 2.6, 11, 0.25);
  appendBox(gContGreen, -30.5, 10.5, -5, 3.2, 2.6, 11, 0.25);
  appendBox(gContRed, -35.5, 10.5, -5, 3.2, 2.6, 11, 0.25);
  appendBox(gContRed, -30.5, 13.1, -5, 3.2, 2.6, 11, 0.25);
  appendBox(gContGreen, -30.5, 7.9, 5, 3.2, 2.6, 7.5, 0.25);
  appendBox(gContBlue, -30.5, 10.5, 5, 3.2, 2.6, 7.5, 0.25);
  // Multi-story Bridge Superstructure at Stern (z = -35.0, framed cleanly in upper-left horizon)
  appendBox(gShipBridge, -33, 9.2, -35.0, 13.8, 5.0, 11.5, 0.2);
  appendBox(gShipBridge, -33, 13.2, -35.5, 12.0, 3.2, 9.5, 0.2);
  appendBox(gShipBridge, -33, 16.0, -34.5, 13.4, 2.4, 7.0, 0.2); // Navigation Bridge Wings
  appendBox(gDarkSteel, -33, 11.7, -28.9, 14.0, 0.18, 0.8, 0.3); // Exterior bridge catwalk
  appendCylinder(gSteel, -33, 20.0, -37.5, 1.3, 1.6, 5.6, 14, 'y'); // Smokestack Funnel
  appendCylinder(gHazard, -33, 21.3, -37.5, 1.36, 1.42, 1.2, 14, 'y'); // Funnel band
  appendCylinder(gDarkSteel, -33, 21.0, -33.5, 0.18, 0.32, 7.8, 10, 'y'); // Radar Mast
  appendBox(gDarkSteel, -33, 23.3, -33.5, 3.8, 0.22, 0.22, 1); // Radar Crossbar
  // Illuminated Bridge Windows & Portholes
  for (let wx = -38; wx <= -28; wx += 2.5) {
    appendBox(gWindows, wx, 9.5, -29.1, 1.2, 0.9, 0.1, 1);
    appendBox(gWindows, wx, 13.3, -30.6, 1.2, 0.9, 0.1, 1);
    appendBox(gWindows, wx, 16.1, -30.9, 1.5, 1.0, 0.1, 1);
  }
  for (let wz = -33.5; wz <= -29.5; wz += 2.0) {
    appendBox(gWindows, -26.0, 9.5, wz, 0.1, 0.9, 1.1, 1);
    appendBox(gWindows, -26.9, 13.3, wz - 2, 0.1, 0.9, 1.1, 1);
  }
  // Ship Starboard Lifeboat Davits, Orange Enclosed Lifeboat & Accommodation Ladder (Matching CAM_HERO)
  appendBox(gDarkSteel, -25.6, 10.6, -24.2, 1.4, 1.8, 0.22, 0.5); // Forward davit arm
  appendBox(gDarkSteel, -25.6, 10.6, -28.2, 1.4, 1.8, 0.22, 0.5); // Aft davit arm
  appendBox(gExplosive, -25.2, 9.6, -26.2, 1.45, 1.05, 4.4, 0.4); // Bright orange enclosed lifeboat hull
  appendBox(gWindows, -24.46, 9.85, -26.2, 0.08, 0.32, 2.2, 1);   // Lifeboat canopy viewport
  appendBox(gLamps, -26.0, 17.8, -28.2, 0.85, 0.28, 0.45, 1);     // Bridge wing searchlight
  // Boarding Gangway Ramp connecting Dock (x = -23.5, z = -12) to Ship Deck (x = -25, y = 6.5) + Handrails
  appendBox(gSteel, -24.2, 3.2, -12, 2.2, 0.3, 12.5, 0.3);
  appendBeam(gDarkSteel, -23.2, 0.9, -5.8, -23.2, 6.8, -18.2, 0.045, 6);
  appendBeam(gDarkSteel, -25.2, 0.9, -5.8, -25.2, 6.8, -18.2, 0.045, 6);

  // 3. Towering Port Gantry Crane straddling West Lane (x = -11.5 to -3.5, z = -22)
  const craneZ = -22;
  const zA = craneZ - 4.5, zB = craneZ + 4.5;
  for (const lx of [-11.5, -3.5]) {
    for (const lz of [zA, craneZ + 4.5]) {
      appendBox(gSteel, lx, 11.0, lz, 0.95, 22.0, 0.95, 0.25); // 4 Portal Legs
      // Bogie Wheel Trucks at base of each crane leg
      appendBox(gDarkSteel, lx, 0.45, lz, 1.35, 0.85, 2.6, 0.3);
    }
    appendBox(gSteel, lx, 6.5, craneZ, 0.7, 0.7, 9.2, 0.25); // Cross strut low
    appendBox(gSteel, lx, 14.5, craneZ, 0.7, 0.7, 9.2, 0.25); // Cross strut mid
    appendBox(gSteel, lx, 21.5, craneZ, 0.9, 1.1, 10.2, 0.25); // Top portal beam
    // Diagonal X-Bracing Trusses along Crane Portal Sides
    appendBeam(gSteel, lx, 1.0, zA, lx, 6.5, zB, 0.18, 6);
    appendBeam(gSteel, lx, 1.0, zB, lx, 6.5, zA, 0.18, 6);
    appendBeam(gSteel, lx, 6.5, zA, lx, 14.5, zB, 0.18, 6);
    appendBeam(gSteel, lx, 6.5, zB, lx, 14.5, zA, 0.18, 6);
    appendBeam(gSteel, lx, 14.5, zA, lx, 21.5, zB, 0.18, 6);
    appendBeam(gSteel, lx, 14.5, zB, lx, 21.5, zA, 0.18, 6);
  }
  // Cross portal bracing between West (-11.5) and East (-3.5) legs at y = 14.5 & y = 21.5
  appendBox(gSteel, -7.5, 14.5, zA, 8.2, 0.65, 0.65, 0.25);
  appendBox(gSteel, -7.5, 14.5, zB, 8.2, 0.65, 0.65, 0.25);
  appendBeam(gSteel, -11.5, 14.5, zA, -3.5, 21.5, zA, 0.18, 6);
  appendBeam(gSteel, -3.5, 14.5, zA, -11.5, 21.5, zA, 0.18, 6);

  // Horizontal Boom extending from x = -38 (over Cargo Ship) to x = +8 (over Container Yard)
  appendBox(gSteel, -15.0, 22.4, craneZ - 2.2, 46.0, 1.2, 1.0, 0.2);
  appendBox(gSteel, -15.0, 22.4, craneZ + 2.2, 46.0, 1.2, 1.0, 0.2);
  for (let bx = -36; bx <= 6; bx += 4.2) {
    appendBox(gSteel, bx, 22.4, craneZ, 0.5, 0.8, 4.4, 0.25);
    if (bx < 4) {
      appendBeam(gSteel, bx, 22.4, craneZ - 2.2, bx + 4.2, 22.4, craneZ + 2.2, 0.14, 5);
    }
  }
  // Upper A-Frame Tower & Stay Cables + Operator Cab + Suspended Container Spreader
  appendBox(gSteel, -7.5, 27.5, craneZ - 2.0, 0.8, 9.5, 0.8, 0.25);
  appendBox(gSteel, -7.5, 27.5, craneZ + 2.0, 0.8, 9.5, 0.8, 0.25);
  appendBox(gSteel, -7.5, 32.0, craneZ, 1.0, 0.9, 4.8, 0.25);
  // Diagonal Forestay & Backstay Tension Cables from Apex (y=32) to Boom ends (y=22.8)
  for (const cz of [craneZ - 2.0, craneZ + 2.0]) {
    appendBeam(gDarkSteel, -7.5, 31.8, cz, -34.0, 22.8, cz, 0.09, 6);
    appendBeam(gDarkSteel, -7.5, 31.8, cz, -19.0, 22.8, cz, 0.08, 6);
    appendBeam(gDarkSteel, -7.5, 31.8, cz, 5.5, 22.8, cz, 0.09, 6);
  }
  appendBox(gDarkSteel, -6.5, 19.8, craneZ, 3.4, 2.8, 3.6, 0.25); // Operator Cabin
  appendBox(gWindows, -6.5, 19.6, craneZ + 1.82, 2.4, 1.2, 0.1, 1);
  // Suspended Spreader Frame & Hoist Cables at x = -18.5 (between ship & quay)
  appendBox(gDarkSteel, -18.5, 21.6, craneZ, 2.8, 0.7, 3.8, 0.25); // Trolley
  for (const cxOff of [-1.0, 1.0]) {
    for (const czOff of [-1.2, 1.2]) {
      appendBeam(gDarkSteel, -18.5 + cxOff, 21.4, craneZ + czOff, -18.5 + cxOff, 12.2, craneZ + czOff, 0.04, 5);
    }
  }
  appendBox(gHazard, -18.5, 12.0, craneZ, 2.6, 0.55, 6.1, 0.3); // Yellow Container Spreader Beam
  // Floodlights under Crane Boom
  for (const fx of [-24, -14, -7.5, 0]) {
    appendBox(gLamps, fx, 21.6, craneZ, 1.1, 0.25, 0.8, 1);
  }

  // 4. Shipping Container Stacks (Matching AGY Hero Concept Art Layout)
  function addContainer(matGeom, cx, cy, cz, len = 6.1, rotY = false) {
    const sx = rotY ? len : 2.44;
    const sz = rotY ? 2.44 : len;
    appendBox(matGeom, cx, cy + 1.3, cz, sx, 2.6, sz, 0.35);
    // Corner castings, top/bottom frame rails & vertical locking bars
    appendBox(gDarkSteel, cx - sx * 0.48, cy + 1.3, cz + sz * 0.5, 0.12, 2.6, 0.12, 1);
    appendBox(gDarkSteel, cx + sx * 0.48, cy + 1.3, cz + sz * 0.5, 0.12, 2.6, 0.12, 1);
    appendBox(gDarkSteel, cx - sx * 0.48, cy + 1.3, cz - sz * 0.5, 0.12, 2.6, 0.12, 1);
    appendBox(gDarkSteel, cx + sx * 0.48, cy + 1.3, cz - sz * 0.5, 0.12, 2.6, 0.12, 1);
    appendBox(gDarkSteel, cx - sx * 0.18, cy + 1.3, cz + sz * 0.505, 0.04, 2.4, 0.04, 1);
    appendBox(gDarkSteel, cx + sx * 0.18, cy + 1.3, cz + sz * 0.505, 0.04, 2.4, 0.04, 1);
  }
  // Left-Center Stack Row (separating West Quay Lane from Center Plaza)
  addContainer(gContRed, -1.8, 0, 14, 6.1);
  addContainer(gContRed, -1.8, 2.6, 14, 6.1);
  addContainer(gContBlue, 0.8, 0, 14, 6.1);
  addContainer(gContBlue, 0.8, 2.6, 14, 6.1);
  addContainer(gContRed, 3.4, 0, 14, 6.1);

  addContainer(gContBlue, -1.8, 0, 4, 6.1);
  addContainer(gContRed, -1.8, 2.6, 4, 6.1);
  addContainer(gContGreen, 0.8, 0, 4, 6.1);

  addContainer(gContRed, -1.8, 0, -6, 6.1);
  addContainer(gContBlue, -1.8, 2.6, -6, 6.1);
  addContainer(gContGreen, 1.2, 0, -6, 6.1);
  addContainer(gContRed, 1.2, 2.6, -6, 6.1);

  // Mid-Right Stack supporting the Elevated Walkway (x = 7.5)
  addContainer(gContRed, 7.5, 0, 11, 6.1);
  addContainer(gContGreen, 7.5, 2.6, 11, 6.1);
  addContainer(gContBlue, 7.5, 0, 2, 6.1);
  addContainer(gContRed, 7.5, 2.6, 2, 6.1);
  addContainer(gContGreen, 7.5, 0, -8, 6.1);
  addContainer(gContBlue, 7.5, 2.6, -8, 6.1);

  // North Terminal Defense Containers (z = -24 to -32)
  addContainer(gContRed, -4.0, 0, -26, 6.1, true);
  addContainer(gContBlue, -4.0, 2.6, -26, 6.1, true);
  addContainer(gContGreen, 4.5, 0, -26, 6.1, true);
  addContainer(gContRed, 12.0, 0, -24, 6.1);

  // 5. Elevated Steel Catwalk & Walkable Staircases (concept-to-playable-3d: slope <= 0.8)
  appendBox(gSteel, 6.2, 5.25, -2, 2.2, 0.18, 32, 0.3);
  appendBox(gSteel, -0.5, 5.25, 2, 14.0, 0.18, 2.2, 0.3); // Overhead bridge across combat lane!
  // Heavy Structural H-Beam Under-Girders, Support Columns, Knee Braces & Under-Bridge Lights (Matching CAM_LANE)
  appendBox(gDarkSteel, -0.5, 5.04, 0.98, 14.2, 0.24, 0.22, 0.3); // South bridge I-beam girder
  appendBox(gDarkSteel, -0.5, 5.04, 3.02, 14.2, 0.24, 0.22, 0.3); // North bridge I-beam girder
  appendBox(gDarkSteel, 5.18, 5.04, -2.0, 0.22, 0.24, 32.0, 0.3); // Main catwalk West girder
  appendBox(gDarkSteel, 7.22, 5.04, -2.0, 0.22, 0.24, 32.0, 0.3); // Main catwalk East girder
  for (let gx = -6.5; gx <= 4.5; gx += 2.2) {
    appendBox(gDarkSteel, gx, 5.06, 2.0, 0.14, 0.18, 2.05, 0.5); // Transverse floor joists under bridge
  }
  // Vertical H-Beam Support Columns & Diagonal Knee Braces at Bridge Ends
  for (const cz of [0.98, 3.02]) {
    appendBox(gDarkSteel, -2.95, 2.55, cz, 0.24, 5.1, 0.24, 0.4); // West lane support column
    appendBeam(gDarkSteel, -2.95, 3.8, cz, -1.65, 5.04, cz, 0.08, 6); // West knee brace
    appendBox(gDarkSteel, 5.18, 2.55, cz, 0.24, 5.1, 0.24, 0.4);  // East lane support column
    appendBeam(gDarkSteel, 5.18, 3.8, cz, 3.85, 5.04, cz, 0.08, 6);  // East knee brace
  }
  // Under-Bridge Glowing Industrial Bulkhead Utility Lamps (illuminating combat lane below)
  appendBox(gLamps, -4.2, 5.02, 2.0, 0.75, 0.09, 0.32, 1);
  appendBox(gLamps, 1.8, 5.02, 2.0, 0.75, 0.09, 0.32, 1);
  // Railings + Vertical Stanchion Posts every 2.5m (matching concept art dense handrail grid)
  appendBox(gDarkSteel, 5.15, 6.15, -2, 0.06, 0.06, 32, 0.3);
  appendBox(gDarkSteel, 5.15, 5.68, -2, 0.05, 0.05, 32, 0.3);
  appendBox(gDarkSteel, 7.25, 6.15, -2, 0.06, 0.06, 32, 0.3);
  appendBox(gDarkSteel, 7.25, 5.68, -2, 0.05, 0.05, 32, 0.3);
  for (let rz = -17.5; rz <= 13.5; rz += 2.2) {
    appendBox(gDarkSteel, 5.15, 5.75, rz, 0.06, 1.0, 0.06, 1);
    appendBox(gDarkSteel, 7.25, 5.75, rz, 0.06, 1.0, 0.06, 1);
  }
  appendBox(gDarkSteel, -0.5, 6.15, 0.95, 14.0, 0.06, 0.06, 0.3);
  appendBox(gDarkSteel, -0.5, 5.68, 0.95, 14.0, 0.05, 0.05, 0.3);
  appendBox(gDarkSteel, -0.5, 6.15, 3.05, 14.0, 0.06, 0.06, 0.3);
  appendBox(gDarkSteel, -0.5, 5.68, 3.05, 14.0, 0.05, 0.05, 0.3);
  for (let rx = -7.0; rx <= 5.0; rx += 2.0) {
    appendBox(gDarkSteel, rx, 5.75, 0.95, 0.06, 1.0, 0.06, 1);
    appendBox(gDarkSteel, rx, 5.75, 3.05, 0.06, 1.0, 0.06, 1);
  }
  // Stair Stringers & Handrails + Steps
  appendBeam(gDarkSteel, 5.3, 0.1, 21.5, 5.3, 5.25, 14.0, 0.08, 6);
  appendBeam(gDarkSteel, 7.1, 0.1, 21.5, 7.1, 5.25, 14.0, 0.08, 6);
  appendBeam(gDarkSteel, 5.3, 1.0, 21.5, 5.3, 6.15, 14.0, 0.045, 6);
  appendBeam(gDarkSteel, 7.1, 1.0, 21.5, 7.1, 6.15, 14.0, 0.045, 6);
  const stairSteps = 18;
  for (let s = 0; s < stairSteps; s++) {
    const t = (s + 0.5) / stairSteps;
    const sy = t * 5.25;
    const sz = 21.5 - t * 7.5;
    appendBox(gSteel, 6.2, sy, sz, 1.8, 0.12, 0.45, 0.5);
  }
  // North Staircase (z = -25.5 -> z = -18.0, y = 0 -> y = 5.25)
  for (let s = 0; s < stairSteps; s++) {
    const t = (s + 0.5) / stairSteps;
    const sy = t * 5.25;
    const sz = -25.5 + t * 7.5;
    appendBox(gSteel, 6.2, sy, sz, 1.8, 0.12, 0.45, 0.5);
  }

  // 6. Eastern Corrugated Port Warehouse with Pitched Gable Roof & Skylights (x = 19, z = -8)
  appendBox(gContBlue, 25.8, 4.2, -8, 0.4, 8.4, 30, 0.2); // East Wall
  appendBox(gContBlue, 19.0, 4.2, -22.8, 14.0, 8.4, 0.4, 0.2); // North Wall
  appendBox(gContBlue, 12.2, 4.2, -16.5, 0.4, 8.4, 13, 0.2); // West Wall North Half
  appendBox(gContBlue, 12.2, 4.2, 2.5, 0.4, 8.4, 9, 0.2); // West Wall South Half (leaves 8m wide bay doorway!)
  appendBox(gContBlue, 12.2, 7.0, -5.5, 0.4, 2.8, 8, 0.2); // West Bay Lintel
  appendBox(gContBlue, 22.0, 4.2, 6.8, 8.0, 8.4, 0.4, 0.2); // South Wall East Half
  // Pitched Gable Roof (Apex at x = 19.0, y = 10.6; Eaves at x = 11.8 & 26.2, y = 8.4)
  for (let s = 0; s < 7; s++) {
    const t = (s + 0.5) / 7;
    const lx = 11.8 + t * 7.2;
    const rx = 26.2 - t * 7.2;
    const ry = 8.4 + t * 2.15;
    appendBox(gSteel, lx, ry, -8, 1.15, 0.22, 31.2, 0.25);
    appendBox(gSteel, rx, ry, -8, 1.15, 0.22, 31.2, 0.25);
  }
  appendBox(gDarkSteel, 19.0, 10.65, -8, 0.8, 0.28, 31.4, 0.3); // Roof Ridge Cap
  // Roof Skylight Panels & Interior Steel Roof Trusses
  for (const sz of [-16, -8, 0]) {
    appendBox(gWindows, 16.0, 9.65, sz, 2.2, 0.26, 2.8, 1);
    appendBox(gWindows, 22.0, 9.65, sz, 2.2, 0.26, 2.8, 1);
    appendBox(gDarkSteel, 19.0, 8.2, sz, 13.4, 0.25, 0.25, 0.3); // Interior Tie Beam
  }
  // Warehouse Exterior Wall Sconces, HVAC Ducts, Roll-Up Shutter Door & Electrical Conduits
  appendBox(gDarkSteel, 12.18, 5.35, -5.5, 0.48, 0.65, 8.2, 0.35); // Roll-up shutter door housing drum
  for (let sy = 4.2; sy <= 5.0; sy += 0.25) {
    appendBox(gSteel, 12.18, sy, -5.5, 0.16, 0.18, 7.9, 0.4); // Partially lowered steel shutter slats
  }
  appendBox(gHazard, 12.0, 1.2, -9.6, 0.28, 2.4, 0.28, 0.5); // North bay door safety bollard
  appendBox(gHazard, 12.0, 1.2, -1.4, 0.28, 2.4, 0.28, 0.5); // South bay door safety bollard
  appendBox(gDarkSteel, 11.8, 6.2, 2.5, 0.7, 1.1, 1.4, 0.5); // HVAC Unit
  appendBox(gDarkSteel, 11.8, 6.2, -13.5, 0.7, 1.1, 1.4, 0.5);
  appendBox(gLamps, 11.95, 6.2, -5.5, 0.25, 0.25, 1.2, 1); // Bay Door Overhead Lamp
  appendBox(gLamps, 19.0, 8.2, -4, 1.8, 0.15, 0.6, 1);
  appendBox(gLamps, 19.0, 8.2, -14, 1.8, 0.15, 0.6, 1);
  appendBox(gWindows, 22.0, 5.5, 7.02, 3.6, 1.2, 0.08, 1);
  appendBox(gWindows, 22.0, 3.2, 7.02, 3.6, 1.0, 0.08, 1);

  // 7. Guard Post Security Booth (x = 14.5, z = 16.5) + Security Boom Barrier Gate
  appendBox(gSteel, 14.5, 1.4, 16.5, 3.4, 2.8, 3.4, 0.3);
  appendBox(gDarkSteel, 14.5, 2.9, 16.5, 3.9, 0.28, 3.9, 0.3);
  appendBox(gDarkSteel, 15.4, 3.3, 15.8, 0.9, 0.55, 1.1, 0.4); // Rooftop AC unit
  appendBox(gWindows, 14.5, 1.55, 18.22, 2.4, 1.1, 0.08, 1);
  appendBox(gWindows, 12.78, 1.55, 16.5, 0.08, 1.1, 2.4, 1);
  // Security Checkpoint Boom Barrier & Pedestal (x = 12.2, z = 19.2)
  appendBox(gHazard, 12.2, 0.6, 19.2, 0.45, 1.2, 0.45, 1);
  appendBeam(gHazard, 12.2, 1.05, 19.2, 8.2, 2.35, 19.2, 0.06, 6);

  // 8. Two Tactical Armored Humvees / LTVs parked outside Warehouse (Matching CAM_HERO Concept Art!)
  function addTacticalHumvee(cx, cz, rot90 = false) {
    const mapX = (lx, lz) => (rot90 ? cx + lz : cx + lx);
    const mapZ = (lx, lz) => (rot90 ? cz - lx : cz + lz);
    const mapS = (sx, sz) => (rot90 ? [sz, sx] : [sx, sz]);

    // Main Armored Chassis & Sloped Hood & Rear Troop Bed
    const [bSx, bSz] = mapS(2.2, 4.6);
    appendBox(gVehicleOD, mapX(0, 0), 0.95, mapZ(0, 0), bSx, 0.95, bSz, 0.4);
    const [cSx, cSz] = mapS(2.05, 2.3);
    appendBox(gVehicleOD, mapX(0, -0.15), 1.72, mapZ(0, -0.15), cSx, 0.78, cSz, 0.4);
    // Roof & Turret Ring + Roof Gun Shield
    const [tSx, tSz] = mapS(0.95, 0.95);
    appendCylinder(gDarkSteel, mapX(0, -0.1), 2.22, mapZ(0, -0.1), 0.48, 0.52, 0.25, 10, 'y');
    appendBox(gVehicleOD, mapX(0, 0.35), 2.42, mapZ(0, 0.35), tSx * 0.7, 0.42, tSz * 0.15, 0.4);
    appendBeam(gDarkSteel, mapX(0, -0.1), 2.38, mapZ(0, -0.1), mapX(0, 0.95), 2.42, mapZ(0, 0.95), 0.04, 6);
    // Ballistic Windshield & Side Windows
    const [wSx, wSz] = mapS(1.78, 0.08);
    appendBox(gWindows, mapX(0, 1.02), 1.72, mapZ(0, 1.02), wSx, 0.46, wSz, 1);
    // Front Bullbar & Glowing Tactical Headlights
    const [gSx, gSz] = mapS(2.25, 0.18);
    appendBox(gDarkSteel, mapX(0, 2.35), 0.82, mapZ(0, 2.35), gSx, 0.55, gSz, 0.5);
    const [hlSx, hlSz] = mapS(0.28, 0.08);
    appendBox(gLamps, mapX(-0.75, 2.32), 0.98, mapZ(-0.75, 2.32), hlSx, 0.22, hlSz, 1);
    appendBox(gLamps, mapX(0.75, 2.32), 0.98, mapZ(0.75, 2.32), hlSx, 0.22, hlSz, 1);
    // 4 Heavy Off-Road Wheels
    for (const wx of [-1.08, 1.08]) {
      for (const wz of [-1.45, 1.45]) {
        const [tySx, tySz] = mapS(0.38, 0.88);
        appendBox(gRubber, mapX(wx, wz), 0.44, mapZ(wx, wz), tySx, 0.88, tySz, 0.5);
        const [rmSx, rmSz] = mapS(0.42, 0.46);
        appendBox(gDarkSteel, mapX(wx, wz), 0.44, mapZ(wx, wz), rmSx, 0.46, rmSz, 0.5);
      }
    }
  }
  addTacticalHumvee(11.8, 10.5, false); // Humvee 1 parked beside elevated staircase & warehouse
  addTacticalHumvee(18.5, 12.2, true);  // Humvee 2 parked facing plaza outside guard post

  // Industrial Port Forklift & Cable Reels & Wooden Pallets
  appendBox(gHazard, -8.8, 0.65, -18.5, 1.4, 1.1, 2.3, 0.4); // Forklift body
  appendBox(gDarkSteel, -8.8, 1.65, -18.3, 1.25, 1.1, 1.5, 0.4); // Forklift cab cage
  appendBox(gDarkSteel, -8.8, 1.35, -19.8, 0.9, 2.5, 0.15, 0.4); // Forklift mast
  // Wooden Cable Spool Reels & Pallet Stacks along West Combat Lane (matching CAM_LANE Concept Art!)
  for (const [rx, rz] of [[-4.2, 6.2], [-9.2, 14.5], [14.2, 4.5]]) {
    appendCylinder(gWood, rx - 0.34, 0.58, rz, 0.58, 0.58, 0.10, 12, 'x'); // Left wooden flange disc
    appendCylinder(gWood, rx + 0.34, 0.58, rz, 0.58, 0.58, 0.10, 12, 'x'); // Right wooden flange disc
    appendCylinder(gDarkSteel, rx, 0.58, rz, 0.38, 0.38, 0.62, 12, 'x');    // Coiled steel cable core
    appendCylinder(gDarkSteel, rx, 0.58, rz, 0.12, 0.12, 0.88, 10, 'x');    // Steel axle rod
  }
  for (const [px, pz] of [[-5.0, 14.5], [-3.8, 10.8], [2.8, 8.8], [13.5, 14.0]]) {
    appendBox(gWood, px, 0.08, pz, 1.4, 0.16, 1.4, 0.5);
    appendBox(gWood, px, 0.26, pz, 1.35, 0.16, 1.35, 0.5);
  }

  // 9. Port Light Poles (Twin-Head High-Mast Floodlight Towers)
  const poles = [
    [-12.0, 20.0], [-12.0, 2.0], [11.5, 21.0], [11.5, 4.0], [11.5, -14.0], [-1.0, -18.0]
  ];
  for (const [px, pz] of poles) {
    appendCylinder(gConcrete, px, 0.45, pz, 0.36, 0.42, 0.9, 10, 'y'); // Concrete pedestal base
    appendCylinder(gDarkSteel, px, 5.8, pz, 0.12, 0.20, 11.2, 10, 'y');
    appendBox(gDarkSteel, px, 11.35, pz, 1.8, 0.20, 0.55, 1);
    appendBox(gLamps, px - 0.52, 11.18, pz, 0.62, 0.14, 0.42, 1);
    appendBox(gLamps, px + 0.52, 11.18, pz, 0.62, 0.14, 0.42, 1);
  }

  // 10. Concrete Jersey Barriers, Fire Barrels, Explosive Red Drums & Tactical Cover Crates
  const barriers = [
    [-0.5, 23.5, 0], [3.5, 23.0, 0], [9.5, 22.5, 0],
    [-8.5, 10.0, 1], [-8.5, -4.0, 1], [3.5, -14.0, 0], [15.5, -2.0, 0],
  ];
  for (const [bx, bz, rot] of barriers) {
    // True sloped trapezoidal New Jersey Barrier profile!
    appendJerseyBarrier(gConcrete, bx, bz, 2.8, rot ? Math.PI * 0.5 : 0, 0.5);
  }
  // Angled Defensive Concrete Jersey Barrier Semicircle & Supply Cache around South Foreground Fire Barrel (-3.2, 25.5) (Matching CAM_HERO!)
  for (const [bx, bz, ang] of [
    [-5.8, 25.4, 0.46],
    [-3.4, 24.1, 0.08],
    [-0.8, 24.8, -0.38],
  ]) {
    appendJerseyBarrier(gConcrete, bx, bz, 2.7, ang, 0.5);
    appendRotatedYBox(gHazard, bx, 0.96, bz, 2.66, 0.08, 0.24, ang, 0.5); // High-vis hazard stripe along barrier top
  }
  // Foreground Palletized Supply Crates & Oil Drum Cluster at South Plaza (Matching CAM_HERO foreground!)
  appendRotatedYBox(gWood, -5.2, 0.08, 26.8, 1.5, 0.16, 1.4, 0.25, 0.5);
  appendRotatedYBox(gWood, -5.2, 0.62, 26.8, 1.15, 0.92, 1.15, 0.28, 0.5);
  appendRotatedYBox(gDarkSteel, -5.2, 1.08, 26.8, 1.19, 0.06, 1.19, 0.28, 0.5);
  appendCylinder(gDarkSteel, -4.1, 0.48, 26.6, 0.30, 0.30, 0.96, 14, 'y');
  appendRotatedYBox(gWood, 1.8, 0.08, 25.2, 1.45, 0.16, 1.45, -0.22, 0.5);
  appendRotatedYBox(gVehicleOD, 1.8, 0.52, 25.2, 1.25, 0.72, 0.85, -0.20, 0.5); // Military ammo supply chest
  // Fire Barrels (with glowing embers + burning wood logs & tipped barrel next to foreground fire!)
  const fireBarrels = [[-3.2, 25.5], [-4.8, 9.5], [4.5, -1.5], [-8.0, -15.0], [15.0, 11.0]];
  for (const [fx, fz] of fireBarrels) {
    appendCylinder(gSteel, fx, 0.48, fz, 0.32, 0.32, 0.96, 14, 'y');
    appendCylinder(gDarkSteel, fx, 0.32, fz, 0.335, 0.335, 0.05, 14, 'y'); // Barrel rib ring
    appendCylinder(gDarkSteel, fx, 0.66, fz, 0.335, 0.335, 0.05, 14, 'y');
    appendCylinder(gFire, fx, 0.94, fz, 0.29, 0.29, 0.08, 12, 'y');
    appendBeam(gWood, fx - 0.14, 0.88, fz - 0.1, fx + 0.16, 1.18, fz + 0.12, 0.05, 5);
    appendBeam(gWood, fx + 0.12, 0.88, fz - 0.14, fx - 0.15, 1.15, fz + 0.1, 0.05, 5);
  }
  // Tipped steel barrel beside foreground fire barrel (-2.4, 25.2) matching CAM_HERO Concept Art!
  appendCylinder(gSteel, -2.35, 0.32, 25.2, 0.31, 0.31, 0.94, 14, 'x');

  // Palletized Industrial Fuel Drum Clusters (Static Decorative Clusters matching CAM_LANE Concept Art!)
  // Note: Interactive destructible red barrels are spawned dynamically in src/main.ts so they vanish cleanly when detonated!
  for (const [dx, dz] of [[14.6, 12.2]]) {
    appendCylinder(gExplosive, dx, 0.56, dz, 0.29, 0.29, 0.92, 14, 'y');
    appendCylinder(gDarkSteel, dx, 0.38, dz, 0.302, 0.302, 0.04, 14, 'y');
    appendCylinder(gDarkSteel, dx, 0.74, dz, 0.302, 0.302, 0.04, 14, 'y');
  }
  appendBox(gWood, -6.45, 0.06, 11.7, 1.55, 0.12, 1.45, 0.5); // Pallet under west lane destructible drum cluster (-6.8,12.0 & -6.1,11.4)
  // Wooden Tactical Crates with Dark Steel Corner Framing (eliminating plain beige cube look!)
  const woodCrates = [[-4.8, 13.0], [-5.2, 11.2], [3.8, 7.5], [16.5, -10.0], [21.0, -12.5]];
  for (const [wx, wz] of woodCrates) {
    appendBox(gWood, wx, 0.65, wz, 1.28, 1.28, 1.28, 0.5);
    appendBox(gDarkSteel, wx, 1.28, wz, 1.32, 0.06, 1.32, 0.5);
    appendBox(gDarkSteel, wx, 0.04, wz, 1.32, 0.06, 1.32, 0.5);
    appendBox(gDarkSteel, wx, 0.65, wz, 1.31, 0.12, 1.31, 0.5);
  }

  // 11. Snaking Heavy Rubber Dock Cables & Faded Quay Lane Striping (matching CAM_LANE Concept Art!)
  const cablePaths = [
    [[-12.0, 20.0], [-10.2, 17.5], [-8.8, 14.5], [-9.2, 11.5], [-11.8, 6.0], [-12.0, 2.0]],
    [[11.5, 21.0], [10.4, 17.0], [11.2, 12.0], [11.5, 4.0], [12.1, -4.5], [11.9, -5.5]],
    [[-7.5, -13.5], [-5.8, -11.0], [-4.8, -6.5], [-4.8, 9.5]],
  ];
  for (const pathPts of cablePaths) {
    for (let i = 0; i < pathPts.length - 1; i++) {
      const [x1, z1] = pathPts[i];
      const [x2, z2] = pathPts[i + 1];
      appendBeam(gRubber, x1, 0.028, z1, x2, 0.028, z2, 0.032, 6);
      appendBeam(gDarkSteel, x1 + 0.12, 0.022, z1, x2 + 0.12, 0.022, z2, 0.022, 5);
    }
  }
  // Faded Yellow Safety Lane Dashes along West Crane Rail & Warehouse Loading Zone
  for (let z = -22; z <= 24; z += 4.5) {
    appendBox(gHazard, -3.1, 0.012, z, 0.16, 0.015, 2.1, 0.5);
    appendBox(gHazard, 9.8, 0.012, z, 0.16, 0.015, 2.1, 0.5);
  }

  // 12. Distant Harbor Breakwater, Opposite Port Cranes, Distant Cargo Ship Silhouettes & Illuminated Channel Buoys (North/West Horizon)
  appendBox(gDarkSteel, -15, 1.2, -56, 110, 2.8, 3.5, 0.2); // Distant North Breakwater Wall
  // Distant Cargo Ship Silhouette along North Horizon
  appendBox(gDarkSteel, -28, 3.2, -62, 28.0, 4.5, 6.0, 0.2);
  appendBox(gShipBridge, -36, 7.2, -62, 6.5, 5.0, 5.2, 0.2);
  appendBox(gWindows, -36, 8.8, -59.3, 4.2, 0.8, 0.1, 1);
  for (const dcx of [-42, -18, 8]) {
    appendBox(gDarkSteel, dcx, 12.0, -56, 0.9, 22.0, 2.5, 0.2);
    appendBox(gDarkSteel, dcx - 4, 21.5, -56, 22.0, 0.9, 0.9, 0.2);
    appendBox(gLamps, dcx, 21.0, -55.2, 1.2, 0.4, 0.4, 1); // Distant crane beacon light
  }
  // Harbor Channel Navigation Buoys floating in West/North Sea Basin
  for (const [bx, bz] of [[-28, 30], [-46, 8], [-48, -22], [-22, -46]]) {
    appendCylinder(gExplosive, bx, -1.0, bz, 0.65, 0.85, 1.2, 10, 'y');
    appendCylinder(gDarkSteel, bx, 0.1, bz, 0.18, 0.45, 1.4, 8, 'y');
    appendBox(gLamps, bx, 0.95, bz, 0.32, 0.32, 0.32, 1);
  }
  // 13. North Harbor Master Control Terminal Objective Console at (-4.0, 0, -18.0)
  appendBox(gConcrete, -4.0, 0.08, -18.0, 2.2, 0.16, 1.8, 0.5); // Terminal concrete pad
  appendBox(gDarkSteel, -4.0, 0.72, -18.0, 1.25, 1.15, 0.85, 0.5); // Armored server cabinet base
  appendBox(gHazard, -4.0, 1.28, -18.0, 1.30, 0.08, 0.90, 0.5); // Yellow hazard bumper trim
  appendBox(gDarkSteel, -4.0, 1.56, -18.12, 1.15, 0.55, 0.45, 0.5); // Upper monitor hood
  appendBox(gWindows, -4.0, 1.55, -17.88, 0.98, 0.42, 0.04, 1); // Illuminated tactical display screen
  appendCylinder(gDarkSteel, -4.52, 2.35, -18.25, 0.035, 0.05, 2.1, 8, 'y'); // Comms telemetry mast
  appendBox(gFire, -4.52, 3.45, -18.25, 0.16, 0.16, 0.16, 1); // Terminal mast beacon light

  const rootNode = b.addNode('NightPort_Environment', [
    b.addMeshPrimitive('Dock_Concrete', gConcrete.positions, gConcrete.normals, gConcrete.uvs, gConcrete.indices, matConcrete),
    b.addMeshPrimitive('Dock_Puddles', gPuddles.positions, gPuddles.normals, gPuddles.uvs, gPuddles.indices, matPuddle),
    b.addMeshPrimitive('Harbor_Sea', gSea.positions, gSea.normals, gSea.uvs, gSea.indices, matSea),
    b.addMeshPrimitive('Containers_Red', gContRed.positions, gContRed.normals, gContRed.uvs, gContRed.indices, matContRed),
    b.addMeshPrimitive('Containers_Blue', gContBlue.positions, gContBlue.normals, gContBlue.uvs, gContBlue.indices, matContBlue),
    b.addMeshPrimitive('Containers_Green', gContGreen.positions, gContGreen.normals, gContGreen.uvs, gContGreen.indices, matContGreen),
    b.addMeshPrimitive('Industrial_RustedSteel', gSteel.positions, gSteel.normals, gSteel.uvs, gSteel.indices, matRustedSteel),
    b.addMeshPrimitive('Dark_Steel_Hardware', gDarkSteel.positions, gDarkSteel.normals, gDarkSteel.uvs, gDarkSteel.indices, matGunmetal),
    b.addMeshPrimitive('Ship_Waterline', gShipRed.positions, gShipRed.normals, gShipRed.uvs, gShipRed.indices, matShipRed),
    b.addMeshPrimitive('Ship_Superstructure', gShipBridge.positions, gShipBridge.normals, gShipBridge.uvs, gShipBridge.indices, matShipBridge),
    b.addMeshPrimitive('Lit_Windows', gWindows.positions, gWindows.normals, gWindows.uvs, gWindows.indices, matLitWindow),
    b.addMeshPrimitive('Sodium_Floodlights', gLamps.positions, gLamps.normals, gLamps.uvs, gLamps.indices, matFloodlight),
    b.addMeshPrimitive('Fire_Embers', gFire.positions, gFire.normals, gFire.uvs, gFire.indices, matFireGlow),
    b.addMeshPrimitive('Hazard_Stripes', gHazard.positions, gHazard.normals, gHazard.uvs, gHazard.indices, matHazard),
    b.addMeshPrimitive('Wooden_Crates', gWood.positions, gWood.normals, gWood.uvs, gWood.indices, matWood),
    b.addMeshPrimitive('Explosive_Drums', gExplosive.positions, gExplosive.normals, gExplosive.uvs, gExplosive.indices, matExplosive),
    b.addMeshPrimitive('Tactical_Vehicles_OD', gVehicleOD.positions, gVehicleOD.normals, gVehicleOD.uvs, gVehicleOD.indices, matOliveVehicle),
    b.addMeshPrimitive('Tire_Rubber_Fenders', gRubber.positions, gRubber.normals, gRubber.uvs, gRubber.indices, matRubber),
  ]);

  b.RootNodes.push(rootNode);
  fs.writeFileSync(path.join(OUT_MODELS, 'port_environment.glb'), b.toGlbBuffer());
  console.log('Saved public/assets/models/port_environment.glb');
}

// ---------------------------------------------------------------------------
// 5. Build CC0 Tactical Soldier Animated GLB (character-skin Skill Route A)
//    Grafts Male_Ranger modular skinned parts + rigid Tactical Helmet (Head) +
//    rigid Plate Carrier Pouches (spine_03) + rigid AR-7 Carbine (hand_r) onto
//    Quaternius UAL1_Standard.glb (65-bone UE skeleton + 43 animations)!
// ---------------------------------------------------------------------------
function buildTacticalSoldierGlb() {
  const ualBuf = fs.readFileSync('assets/source_cc0/qofficial/base/UAL1_Standard.glb');
  const jsonLen = ualBuf.readUInt32LE(12);
  const gltf = JSON.parse(ualBuf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const binLen = ualBuf.readUInt32LE(20 + jsonLen);
  const binChunks = [ualBuf.subarray(binStart, binStart + binLen)];
  let totalBinOffset = binChunks[0].length;

  function appendBinChunk(buf, target) {
    const pad = (4 - (buf.length % 4)) % 4;
    const padded = pad ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf;
    const bvIdx = gltf.bufferViews.length;
    const bv = { buffer: 0, byteOffset: totalBinOffset, byteLength: buf.length };
    if (target) bv.target = target;
    gltf.bufferViews.push(bv);
    binChunks.push(padded);
    totalBinOffset += padded.length;
    return bvIdx;
  }

  // Embed PBR Texture Sets (tactical_camo & gunmetal_pbr) with REPEAT Sampler into Soldier GLB
  gltf.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
  gltf.images = gltf.images || [];
  gltf.textures = gltf.textures || [];

  function addEmbeddedPngTexture(pngBuf, name) {
    const bvIdx = appendBinChunk(pngBuf);
    const imgIdx = gltf.images.length;
    gltf.images.push({ name, bufferView: bvIdx, mimeType: 'image/png' });
    const texIdx = gltf.textures.length;
    gltf.textures.push({ source: imgIdx, sampler: 0 });
    return texIdx;
  }

  const camoAlbedoTex = addEmbeddedPngTexture(TEX_SETS.tactical_camo.albedoPng, 'Soldier_Camo_Albedo');
  const camoNormalTex = addEmbeddedPngTexture(TEX_SETS.tactical_camo.normalPng, 'Soldier_Camo_Normal');
  const camoOrmTex = addEmbeddedPngTexture(TEX_SETS.tactical_camo.ormPng, 'Soldier_Camo_ORM');
  const gunAlbedoTex = addEmbeddedPngTexture(TEX_SETS.gunmetal_pbr.albedoPng, 'Soldier_Gunmetal_Albedo');
  const gunNormalTex = addEmbeddedPngTexture(TEX_SETS.gunmetal_pbr.normalPng, 'Soldier_Gunmetal_Normal');
  const gunOrmTex = addEmbeddedPngTexture(TEX_SETS.gunmetal_pbr.ormPng, 'Soldier_Gunmetal_ORM');

  // Create Tactical Military PBR Materials matching AGY soldier_tactical_sheet.jpg + Rigforge CC0 Hands/Forearms
  gltf.materials = gltf.materials || [];
  const matCamoUniform = gltf.materials.length;
  gltf.materials.push({
    name: 'MI_Tactical_Camo_Uniform',
    pbrMetallicRoughness: {
      baseColorFactor: [0.85, 0.92, 0.82, 1.0],
      baseColorTexture: { index: camoAlbedoTex },
      metallicRoughnessTexture: { index: camoOrmTex },
      roughnessFactor: 0.92,
      metallicFactor: 0.15,
    },
    normalTexture: { index: camoNormalTex, scale: 0.85 },
    occlusionTexture: { index: camoOrmTex, strength: 0.8 },
  });
  const matPlateCarrier = gltf.materials.length;
  gltf.materials.push({
    name: 'MI_Tactical_PlateCarrier_OD',
    pbrMetallicRoughness: {
      baseColorFactor: [0.68, 0.74, 0.62, 1.0],
      baseColorTexture: { index: camoAlbedoTex },
      metallicRoughnessTexture: { index: camoOrmTex },
      roughnessFactor: 0.85,
      metallicFactor: 0.28,
    },
    normalTexture: { index: camoNormalTex, scale: 0.95 },
    occlusionTexture: { index: camoOrmTex, strength: 0.85 },
  });
  const matSkinHands = gltf.materials.length;
  gltf.materials.push({
    name: 'MI_CC0_Skin_Hands_Forearms',
    pbrMetallicRoughness: {
      baseColorFactor: [0.34, 0.30, 0.25, 1.0],
      baseColorTexture: { index: camoAlbedoTex },
      metallicRoughnessTexture: { index: camoOrmTex },
      roughnessFactor: 0.78,
      metallicFactor: 0.14,
    },
    normalTexture: { index: camoNormalTex, scale: 0.45 },
  });
  const matBalaclavaBoots = gltf.materials.length;
  gltf.materials.push({
    name: 'MI_Tactical_Balaclava_Boots',
    pbrMetallicRoughness: {
      baseColorFactor: [0.22, 0.24, 0.26, 1.0],
      baseColorTexture: { index: gunAlbedoTex },
      metallicRoughnessTexture: { index: gunOrmTex },
      roughnessFactor: 0.78,
      metallicFactor: 0.35,
    },
    normalTexture: { index: gunNormalTex, scale: 0.45 },
  });
  const matHelmet = gltf.materials.length;
  gltf.materials.push({
    name: 'MI_Ballistic_Helmet_OD',
    pbrMetallicRoughness: {
      baseColorFactor: [0.58, 0.66, 0.52, 1.0],
      baseColorTexture: { index: camoAlbedoTex },
      metallicRoughnessTexture: { index: camoOrmTex },
      roughnessFactor: 0.58,
      metallicFactor: 0.42,
    },
    normalTexture: { index: camoNormalTex, scale: 0.55 },
  });
  const matVisorGlow = gltf.materials.length;
  gltf.materials.push({
    name: 'MI_Tactical_Visor_Amber',
    pbrMetallicRoughness: { baseColorFactor: [0.95, 0.55, 0.12, 1.0], roughnessFactor: 0.15, metallicFactor: 0.85 },
    emissiveFactor: [1.4, 0.55, 0.08],
  });
  const matRifle = gltf.materials.length;
  gltf.materials.push({
    name: 'MI_Soldier_Rifle_Gunmetal',
    pbrMetallicRoughness: {
      baseColorFactor: [0.45, 0.48, 0.54, 1.0],
      baseColorTexture: { index: gunAlbedoTex },
      metallicRoughnessTexture: { index: gunOrmTex },
      roughnessFactor: 0.52,
      metallicFactor: 0.88,
    },
    normalTexture: { index: gunNormalTex, scale: 0.35 },
  });

  // Graft modular skinned meshes (Male_Ranger_Body, Arms, Legs, Feet_Boots) onto the 65-bone skin
  // Note: Male_Ranger_Arms has 2 primitives: prim 0 = rolled sleeves/bracers (Camo), prim 1 = forearms & 5-finger hands (CC0 Skin)!
  // We split Arms into its own dedicated SkinnedMesh node ('Soldier_CC0_Arms') so First-Person view can show ONLY the CC0 arms + wristwatch while Third-Person shows the full body!
  const modularParts = [
    { file: 'assets/source_cc0/qofficial/modular/Male_Ranger_Body.gltf', mats: [matPlateCarrier, matCamoUniform], isArms: false, onlyFirstMesh: true },
    { file: 'assets/source_cc0/qofficial/modular/Male_Ranger_Arms.gltf', mats: [matCamoUniform, matSkinHands], isArms: true, onlyFirstMesh: false },
    { file: 'assets/source_cc0/qofficial/modular/Male_Ranger_Legs.gltf', mats: [matCamoUniform, matCamoUniform], isArms: false, onlyFirstMesh: true },
    { file: 'assets/source_cc0/qofficial/modular/Male_Ranger_Feet_Boots.gltf', mats: [matBalaclavaBoots, matCamoUniform], isArms: false, onlyFirstMesh: true },
  ];

  const graftedBodyPrims = [];
  const graftedArmsPrims = [];
  for (const part of modularParts) {
    const partDir = path.dirname(part.file);
    const partJson = JSON.parse(fs.readFileSync(part.file, 'utf8'));
    const partBin = fs.readFileSync(path.join(partDir, partJson.buffers[0].uri));

    function cloneAccessor(accIdx) {
      const srcAcc = partJson.accessors[accIdx];
      const srcBv = partJson.bufferViews[srcAcc.bufferView];
      const slice = partBin.subarray(srcBv.byteOffset || 0, (srcBv.byteOffset || 0) + srcBv.byteLength);
      const newBvIdx = appendBinChunk(slice, srcBv.target);
      const newAccIdx = gltf.accessors.length;
      const cloned = { ...srcAcc, bufferView: newBvIdx };
      gltf.accessors.push(cloned);
      return newAccIdx;
    }

    const meshesToUse = part.onlyFirstMesh ? [partJson.meshes[0]] : partJson.meshes;
    for (const m of meshesToUse) {
      m.primitives.forEach((p, pIdx) => {
        const newAttrs = {};
        for (const [k, v] of Object.entries(p.attributes)) {
          if (k.startsWith('COLOR_')) continue; // Strip vertex color overrides
          newAttrs[k] = cloneAccessor(v);
        }
        const primObj = {
          attributes: newAttrs,
          indices: cloneAccessor(p.indices),
          material: part.mats[pIdx] ?? part.mats[0],
        };
        if (part.isArms) {
          graftedArmsPrims.push(primObj);
        } else {
          graftedBodyPrims.push(primObj);
        }
      });
    }
  }

  // Replace the orange/white UAL1 mannequin primitives with the grafted tactical body/legs primitives
  if (gltf.meshes && gltf.meshes[0]) {
    gltf.meshes[0].name = 'Soldier_Body_Legs_Mesh';
    gltf.meshes[0].primitives = graftedBodyPrims;
    gltf.nodes[65].name = 'Soldier_Body_Legs';
  }
  // Add dedicated SkinnedMesh node for CC0 Arms & 5-Finger Hands ('Soldier_CC0_Arms') attached to Armature (node 66)
  const armsMeshIdx = gltf.meshes.length;
  gltf.meshes.push({
    name: 'Soldier_CC0_Arms_Mesh',
    primitives: graftedArmsPrims,
  });
  const armsNodeIdx = gltf.nodes.length;
  gltf.nodes.push({
    name: 'Soldier_CC0_Arms',
    mesh: armsMeshIdx,
    skin: 0,
  });
  gltf.nodes[66].children = gltf.nodes[66].children || [];
  gltf.nodes[66].children.push(armsNodeIdx);

  // Helper to add a rigid 3D mesh node attached directly as a child of a bone node (100% rigid, 0 deformation!)
  function addRigidAttachmentNode(parentBoneIdx, name, geom, matIdx) {
    const posArr = new Float32Array(geom.positions);
    const normArr = new Float32Array(geom.normals);
    const uvArr = new Float32Array(geom.uvs && geom.uvs.length === (posArr.length / 3) * 2 ? geom.uvs : (posArr.length / 3) * 2);
    const idxArr = new Uint32Array(geom.indices);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < posArr.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (posArr[i + k] < min[k]) min[k] = posArr[i + k];
        if (posArr[i + k] > max[k]) max[k] = posArr[i + k];
      }
    }
    const posBv = appendBinChunk(Buffer.from(posArr.buffer), 34962);
    const normBv = appendBinChunk(Buffer.from(normArr.buffer), 34962);
    const uvBv = appendBinChunk(Buffer.from(uvArr.buffer), 34962);
    const idxBv = appendBinChunk(Buffer.from(idxArr.buffer), 34963);
    const posAcc = gltf.accessors.length;
    gltf.accessors.push({ bufferView: posBv, componentType: 5126, count: posArr.length / 3, type: 'VEC3', min, max });
    const normAcc = gltf.accessors.length;
    gltf.accessors.push({ bufferView: normBv, componentType: 5126, count: normArr.length / 3, type: 'VEC3' });
    const uvAcc = gltf.accessors.length;
    gltf.accessors.push({ bufferView: uvBv, componentType: 5126, count: uvArr.length / 2, type: 'VEC2' });
    const idxAcc = gltf.accessors.length;
    gltf.accessors.push({ bufferView: idxBv, componentType: 5125, count: idxArr.length, type: 'SCALAR' });

    const meshIdx = gltf.meshes.length;
    gltf.meshes.push({
      name: `${name}_Mesh`,
      primitives: [{ attributes: { POSITION: posAcc, NORMAL: normAcc, TEXCOORD_0: uvAcc }, indices: idxAcc, material: matIdx }],
    });
    const nodeIdx = gltf.nodes.length;
    gltf.nodes.push({ name, mesh: meshIdx, translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] });
    gltf.nodes[parentBoneIdx].children = gltf.nodes[parentBoneIdx].children || [];
    gltf.nodes[parentBoneIdx].children.push(nodeIdx);
  }

  // 1) Sleek Rounded Ballistic Head & FAST Helmet + Dual-Tube NVG + Visor attached to Head bone (node 0)
  const gBalaclavaHead = makeGeometryCollector();
  appendCylinder(gBalaclavaHead, 0, 0.085, 0.0, 0.084, 0.072, 0.17, 14, 'y'); // Balaclava head/neck
  addRigidAttachmentNode(0, 'Tactical_Balaclava_Head_Rigid', gBalaclavaHead, matBalaclavaBoots);

  const gHelmet = makeGeometryCollector();
  appendCylinder(gHelmet, 0, 0.14, -0.006, 0.102, 0.108, 0.105, 16, 'y'); // Rounded FAST Helmet Shell
  appendCylinder(gHelmet, 0, 0.198, -0.006, 0.064, 0.102, 0.036, 16, 'y'); // Top crown dome
  appendBox(gHelmet, -0.102, 0.135, -0.01, 0.014, 0.026, 0.11, 1);        // Left ARC Accessory Rail & Comms Headset
  appendBox(gHelmet, 0.102, 0.135, -0.01, 0.014, 0.026, 0.11, 1);         // Right ARC Accessory Rail & Comms Headset
  appendBox(gHelmet, 0, 0.155, 0.098, 0.042, 0.036, 0.024, 1);            // Wilcox NVG Shroud Mount
  // Dual-Tube Night Vision Goggles (GPNVG / PVS-31) mounted on helmet front
  appendCylinder(gHelmet, -0.028, 0.145, 0.135, 0.016, 0.018, 0.065, 10, 'z');
  appendCylinder(gHelmet, 0.028, 0.145, 0.135, 0.016, 0.018, 0.065, 10, 'z');
  addRigidAttachmentNode(0, 'Tactical_Helmet_Rigid', gHelmet, matHelmet);

  const gVisor = makeGeometryCollector();
  appendBox(gVisor, 0, 0.098, 0.084, 0.128, 0.034, 0.028, 1); // Tactical Amber Ballistic Goggles
  appendCylinder(gVisor, -0.028, 0.145, 0.168, 0.014, 0.014, 0.004, 10, 'z'); // NVG Glowing Objective Lens L
  appendCylinder(gVisor, 0.028, 0.145, 0.168, 0.014, 0.014, 0.004, 10, 'z');  // NVG Glowing Objective Lens R
  addRigidAttachmentNode(0, 'Tactical_Visor_Rigid', gVisor, matVisorGlow);

  // 2) Rigid Plate Carrier Chest Pouches, Back Assault Pack & Radio Antenna attached to spine_03 (node 50)
  const gVest = makeGeometryCollector();
  appendBox(gVest, -0.065, 0.02, 0.148, 0.048, 0.098, 0.036, 1); // Mag pouch 1
  appendBox(gVest, 0.0, 0.02, 0.152, 0.048, 0.098, 0.036, 1);    // Mag pouch 2
  appendBox(gVest, 0.065, 0.02, 0.148, 0.048, 0.098, 0.036, 1);  // Mag pouch 3
  appendBox(gVest, -0.095, 0.11, 0.125, 0.036, 0.075, 0.032, 1); // Shoulder Tactical Radio (PRC-152)
  appendCylinder(gVest, -0.105, 0.24, 0.125, 0.004, 0.005, 0.22, 6, 'y'); // Whip antenna
  appendBox(gVest, 0.0, 0.05, -0.155, 0.21, 0.26, 0.095, 1);     // Rear MOLLE Tactical Assault Pack (matching soldier_tactical_sheet.jpg!)
  appendBox(gVest, 0.0, -0.06, -0.145, 0.16, 0.085, 0.075, 1);   // Lower waist utility pack
  addRigidAttachmentNode(50, 'Tactical_PlateCarrier_Rigid', gVest, matPlateCarrier);

  // 2b) Rigid Drop-Leg Tactical Holster on thigh_r (node 62) & Tactical Knee Pads on calf_l (node 56) / calf_r (node 61)
  const gHolster = makeGeometryCollector();
  appendBox(gHolster, -0.092, -0.14, 0.02, 0.045, 0.135, 0.078, 1); // Kydex Drop-Leg Pistol Holster
  appendBox(gHolster, -0.096, -0.06, 0.02, 0.028, 0.065, 0.042, 1); // Pistol grip protruding from holster
  addRigidAttachmentNode(62, 'Tactical_Holster_Rigid', gHolster, matBalaclavaBoots);

  const gKneeL = makeGeometryCollector();
  appendBox(gKneeL, 0.0, 0.34, 0.068, 0.088, 0.105, 0.038, 1); // Molded hard-shell knee cap L
  addRigidAttachmentNode(56, 'Tactical_KneePad_L_Rigid', gKneeL, matHelmet);

  const gKneeR = makeGeometryCollector();
  appendBox(gKneeR, 0.0, 0.34, 0.068, 0.088, 0.105, 0.038, 1); // Molded hard-shell knee cap R
  addRigidAttachmentNode(61, 'Tactical_KneePad_R_Rigid', gKneeR, matHelmet);

  // 4) Left Wrist Tactical Digital Watch attached to lowerarm_l (node 23) for First-Person CC0 View!
  const gWatch = makeGeometryCollector();
  appendBox(gWatch, 0.0, 0.21, 0.0, 0.056, 0.022, 0.056, 1); // Watch strap around wrist
  appendBox(gWatch, 0.0, 0.21, 0.030, 0.034, 0.032, 0.012, 1); // Watch bezel
  addRigidAttachmentNode(23, 'Tactical_WristWatch_Rigid', gWatch, matBalaclavaBoots);
  const gWatchScreen = makeGeometryCollector();
  appendBox(gWatchScreen, 0.0, 0.21, 0.037, 0.024, 0.022, 0.004, 1); // Glowing watch face
  addRigidAttachmentNode(23, 'Tactical_WatchScreen_Rigid', gWatchScreen, matVisorGlow);

  // 3) Rigid Detailed AR-7 Carbine attached to spine_03 (node 50) shoulder pocket so it ALWAYS points horizontally forward (+Z in character frame), never straight up in the air!
  //    In runtime, both hands (hand_r on pistol grip, hand_l on foregrip) are locked onto this rifle via Rigforge 2-Bone IK!
  const gRifle = makeGeometryCollector();
  appendBox(gRifle, -0.10, 0.02, 0.28, 0.036, 0.050, 0.44, 1); // Receiver & M-LOK Handguard extending forward (+Z)
  appendCylinder(gRifle, -0.10, 0.032, 0.58, 0.010, 0.011, 0.28, 10, 'z'); // Barrel & Flash Hider pointing horizontally forward (+Z)
  appendBox(gRifle, -0.10, 0.066, 0.22, 0.034, 0.038, 0.062, 1); // EOTech Holo Sight
  appendBox(gRifle, -0.10, -0.055, 0.26, 0.024, 0.11, 0.048, 1); // Curved 30-rd Mag
  appendBox(gRifle, -0.10, -0.038, 0.36, 0.020, 0.075, 0.024, 1); // Vertical Foregrip (for Left Hand IK target!)
  appendBox(gRifle, -0.10, -0.042, 0.13, 0.026, 0.082, 0.032, 1); // Pistol Grip (for Right Hand IK target!)
  appendBox(gRifle, -0.10, 0.012, 0.03, 0.034, 0.088, 0.13, 1);  // Buttstock tucked into right shoulder pocket
  addRigidAttachmentNode(50, 'Soldier_AR7_Rifle_Rigid', gRifle, matRifle);

  const finalBin = Buffer.concat(binChunks);
  gltf.buffers[0].byteLength = finalBin.length;
  const jsonStr = JSON.stringify(gltf);
  const jsonPad = (4 - (Buffer.byteLength(jsonStr) % 4)) % 4;
  const jsonBuf = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf8');

  const totalLen = 12 + 8 + jsonBuf.length + 8 + finalBin.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 4, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLen, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonBuf.length, 0);
  jsonHead.write('JSON', 4, 4, 'ascii');
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(finalBin.length, 0);
  binHead.write('BIN\x00', 4, 4, 'ascii');

  const outPath = path.join(OUT_MODELS, 'soldier_tactical_animated.glb');
  fs.writeFileSync(outPath, Buffer.concat([header, jsonHead, jsonBuf, binHead, finalBin]));
  console.log(`Saved ${outPath} with ${gltf.animations.length} CC0 animations and 65-bone skeleton!`);
}

buildWeaponsPackGlb();
buildPortEnvironmentGlb();
buildTacticalSoldierGlb();
