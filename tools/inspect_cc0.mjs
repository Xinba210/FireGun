import fs from 'node:fs';
import zlib from 'node:zlib';

function ensureUncompressedGlb(p) {
  let buf = fs.readFileSync(p);
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    buf = zlib.gunzipSync(buf);
    fs.writeFileSync(p, buf);
  }
  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic !== 'glTF') throw new Error(`Invalid magic ${magic} in ${p}`);
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

// Decompress all kaykit & quaternius dist GLBs in place
for (const dir of ['assets/source_cc0/kaykit', 'assets/source_cc0/quaternius']) {
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.glb')) {
      ensureUncompressedGlb(`${dir}/${f}`);
    }
  }
}

const ual1 = ensureUncompressedGlb('assets/source_cc0/qofficial/base/UAL1_Standard.glb');
console.log('UAL1 animations (' + ual1.animations.length + '):', ual1.animations.map(a => a.name));
console.log('UAL1 meshes:', ual1.meshes?.map(m => m.name));
console.log('UAL1 key bones:', ual1.nodes.map((n, i) => `${i}:${n.name}`).filter(s => /hand|head|spine|pelvis|foot|calf|thigh|arm|clavicle|root/i.test(s)));

const ual2 = ensureUncompressedGlb('assets/source_cc0/qofficial/base/UAL2_Standard.glb');
console.log('UAL2 animations (' + ual2.animations.length + '):', ual2.animations.map(a => a.name));

const kayRanged = ensureUncompressedGlb('assets/source_cc0/kaykit/kaykit-11-rig-medium-combatranged.glb');
console.log('KayKit Ranged (' + kayRanged.animations.length + '):', kayRanged.animations.map(a => a.name));
const kayBasic = ensureUncompressedGlb('assets/source_cc0/kaykit/kaykit-11-rig-medium-movementbasic.glb');
console.log('KayKit Basic (' + kayBasic.animations.length + '):', kayBasic.animations.map(a => a.name));
const kaySim = ensureUncompressedGlb('assets/source_cc0/kaykit/kaykit-11-rig-medium-simulation.glb');
console.log('KayKit Sim (' + kaySim.animations.length + '):', kaySim.animations.map(a => a.name));
