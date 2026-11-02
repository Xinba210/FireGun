/**
 * FireGun Realistic FPS — Procedural Spatial Audio WAV Generator (CC0 / Original)
 * Generates 16-bit PCM WAV files in public/assets/audio/ for both Three.js and Godot 4.7.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT_AUDIO = 'public/assets/audio';
fs.mkdirSync(OUT_AUDIO, { recursive: true });

const SAMPLE_RATE = 22050;

function writeWav(filename, samplesFloat) {
  const numSamples = samplesFloat.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // Mono (ideal for 3D Spatial Audio PannerNode / AudioStreamPlayer3D)
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samplesFloat[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT_AUDIO, filename), buf);
}

function synth(durationSec, fn) {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const out = new Float32Array(n);
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 4294967295) * 2 - 1;
  };
  for (let i = 0; i < n; i++) {
    out[i] = fn(i / SAMPLE_RATE, i, rand);
  }
  return out;
}

// 1. AR-7 Carbine Gunshot
writeWav('ar7_shot.wav', synth(0.38, (t, _, rand) => {
  const punch = Math.sin(2 * Math.PI * (160 * Math.exp(-t * 28)) * t) * Math.exp(-t * 22);
  const crack = rand() * Math.exp(-t * 35) * 0.9;
  const tail = rand() * Math.exp(-t * 8.5) * 0.28;
  return (punch * 0.75 + crack + tail) * 0.95;
}));

// 2. SR-9 Sniper Gunshot
writeWav('sr9_shot.wav', synth(0.75, (t, _, rand) => {
  const sub = Math.sin(2 * Math.PI * (110 * Math.exp(-t * 14)) * t) * Math.exp(-t * 10);
  const crack = rand() * Math.exp(-t * 18) * 0.95;
  const echo = rand() * Math.exp(-Math.max(0, t - 0.12) * 5.0) * 0.35;
  return (sub * 0.8 + crack + echo) * 0.95;
}));

// 3. RL-7 Rocket Launch
writeWav('rl7_shot.wav', synth(0.85, (t, _, rand) => {
  const env = Math.min(1, t * 25) * Math.exp(-t * 3.8);
  const whoosh = rand() * env * 0.8;
  const rumble = Math.sin(2 * Math.PI * (68 + t * 40) * t) * env * 0.45;
  return whoosh + rumble;
}));

// 4. Explosion
writeWav('explosion.wav', synth(1.4, (t, _, rand) => {
  const boom = Math.sin(2 * Math.PI * (55 * Math.exp(-t * 4)) * t) * Math.exp(-t * 3.2);
  const roar = rand() * Math.exp(-t * 2.6) * 0.85;
  return (boom * 0.85 + roar) * 0.95;
}));

// 5. Weapon Reload (Mag out -> Mag in -> Bolt rack)
writeWav('reload.wav', synth(1.1, (t, _, rand) => {
  const c1 = t > 0.08 && t < 0.16 ? Math.sin(2 * Math.PI * 820 * t) * Math.exp(-(t - 0.08) * 45) + rand() * 0.3 : 0;
  const c2 = t > 0.48 && t < 0.58 ? Math.sin(2 * Math.PI * 640 * t) * Math.exp(-(t - 0.48) * 40) + rand() * 0.4 : 0;
  const c3 = t > 0.82 && t < 0.96 ? Math.sin(2 * Math.PI * 1150 * t) * Math.exp(-(t - 0.82) * 35) + rand() * 0.45 : 0;
  return (c1 + c2 + c3) * 0.85;
}));

// 6. Bullet Impacts (Metal, Concrete, Water)
writeWav('impact_metal.wav', synth(0.28, (t, _, rand) => {
  const ping = (Math.sin(2 * Math.PI * 1950 * t) + 0.6 * Math.sin(2 * Math.PI * 3120 * t)) * Math.exp(-t * 18);
  return ping * 0.6 + rand() * Math.exp(-t * 45) * 0.4;
}));
writeWav('impact_concrete.wav', synth(0.20, (t, _, rand) => {
  return rand() * Math.exp(-t * 28) * 0.7 + Math.sin(2 * Math.PI * 240 * t) * Math.exp(-t * 35) * 0.4;
}));
writeWav('impact_water.wav', synth(0.32, (t, _, rand) => {
  return rand() * Math.sin(2 * Math.PI * (420 + t * 600) * t) * Math.exp(-t * 14) * 0.75;
}));

// 7. Surface Footsteps (Concrete, Metal Catwalk, Water Puddle)
writeWav('footstep_concrete.wav', synth(0.14, (t, _, rand) => {
  return (Math.sin(2 * Math.PI * 130 * t) * 0.5 + rand() * 0.4) * Math.exp(-t * 32);
}));
writeWav('footstep_metal.wav', synth(0.16, (t, _, rand) => {
  return (Math.sin(2 * Math.PI * 680 * t) * 0.45 + Math.sin(2 * Math.PI * 1340 * t) * 0.25 + rand() * 0.3) * Math.exp(-t * 26);
}));
writeWav('footstep_water.wav', synth(0.18, (t, _, rand) => {
  return rand() * Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t * 22) * 0.65;
}));

// 8. Harbor Night Ambience Loop (Sea waves, night wind, distant foghorn)
writeWav('harbor_ambience_loop.wav', synth(4.0, (t, _, rand) => {
  const waveEnv = 0.45 + 0.35 * Math.sin((2 * Math.PI * t) / 4.0);
  const wind = rand() * 0.08 * waveEnv;
  const hornEnv = t > 1.2 && t < 2.8 ? Math.sin(((t - 1.2) / 1.6) * Math.PI) : 0;
  const horn = (Math.sin(2 * Math.PI * 82 * t) + 0.5 * Math.sin(2 * Math.PI * 123 * t)) * hornEnv * 0.14;
  return wind + horn;
}));

// 9. Tactical Radio Squelch & Alert
writeWav('radio_chatter.wav', synth(0.55, (t, _, rand) => {
  const beep = t < 0.12 ? Math.sin(2 * Math.PI * 1480 * t) * 0.35 : 0;
  const squelch = t >= 0.12 ? rand() * 0.18 * Math.exp(-(t - 0.12) * 5) : 0;
  return beep + squelch;
}));

console.log('Generated 13 spatial WAV audio files in public/assets/audio/');
