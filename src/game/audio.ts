// Tactical Radio & Audio Engine (Web Audio API + Bandpass Transceiver & Voice Synthesis)

export class TacticalRadioAudioEngine {
  private ctx: AudioContext | null = null;
  private radioFilterNode: BiquadFilterNode | null = null;
  private radioDistortionNode: WaveShaperNode | null = null;
  private masterGain: GainNode | null = null;
  private sfxBuffers: Map<string, AudioBuffer> = new Map();
  private helicopterOsc1: OscillatorNode | null = null;
  private helicopterOsc2: OscillatorNode | null = null;
  private helicopterGain: GainNode | null = null;
  private speechQueue: { speaker: string; text: string; onStart?: () => void; onEnd?: () => void }[] = [];
  private isSpeaking = false;

  constructor() {
    // Lazy initialize on first user interaction
  }

  public async initAudio(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);

    // Military Tactical Walkie-Talkie Transceiver Filter (Bandpass 350Hz - 3400Hz)
    this.radioFilterNode = this.ctx.createBiquadFilter();
    this.radioFilterNode.type = 'bandpass';
    this.radioFilterNode.frequency.value = 1750;
    this.radioFilterNode.Q.value = 1.4;

    // Slight analog radio wave clipping distortion
    this.radioDistortionNode = this.ctx.createWaveShaper();
    this.radioDistortionNode.curve = this.makeDistortionCurve(18);
    this.radioDistortionNode.oversample = '4x';

    this.radioFilterNode.connect(this.radioDistortionNode);
    this.radioDistortionNode.connect(this.masterGain);
  }

  private makeDistortionCurve(amount = 20): Float32Array<ArrayBuffer> {
    const k = amount;
    const nSamples = 44100;
    const buffer = new ArrayBuffer(nSamples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Synthesize authentic tactical radio squelch burst (Key-in chirp)
   */
  public playRadioSquelch(type: 'open' | 'close' = 'open'): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'open') {
      // 1200Hz to 2400Hz tactical chirp
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(2600, now + 0.045);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.07);

      // Noise burst
      this.playWhiteNoiseBurst(0.035, 0.12);
    } else {
      // 2200Hz to 950Hz close click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.05);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.06);

      this.playWhiteNoiseBurst(0.045, 0.15);
    }
  }

  private playWhiteNoiseBurst(durationSec = 0.04, volume = 0.1): void {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * durationSec);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 2.5;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationSec);

    whiteNoise.connect(filter).connect(gain).connect(this.masterGain!);
    whiteNoise.start();
  }

  /**
   * Synthesize real-time helicopter rotor pulse and turbine whine
   */
  public startHelicopterAudio(initialVol = 0.35): void {
    if (!this.ctx) return;
    if (this.helicopterGain) return; // already active

    const now = this.ctx.currentTime;
    this.helicopterGain = this.ctx.createGain();
    this.helicopterGain.gain.setValueAtTime(initialVol, now);
    this.helicopterGain.connect(this.masterGain!);

    // Main rotor low-frequency thumping (24 Hz fundamental with pulse shaping)
    const rotorOsc = this.ctx.createOscillator();
    rotorOsc.type = 'sawtooth';
    rotorOsc.frequency.setValueAtTime(24, now);

    const rotorFilter = this.ctx.createBiquadFilter();
    rotorFilter.type = 'lowpass';
    rotorFilter.frequency.setValueAtTime(140, now);

    // Turbine high-frequency whine (850 Hz)
    const turbineOsc = this.ctx.createOscillator();
    turbineOsc.type = 'sine';
    turbineOsc.frequency.setValueAtTime(780, now);
    const turbineGain = this.ctx.createGain();
    turbineGain.gain.setValueAtTime(0.045, now);

    rotorOsc.connect(rotorFilter).connect(this.helicopterGain);
    turbineOsc.connect(turbineGain).connect(this.helicopterGain);

    rotorOsc.start(now);
    turbineOsc.start(now);

    this.helicopterOsc1 = rotorOsc;
    this.helicopterOsc2 = turbineOsc;
  }

  public setHelicopterVolume(vol: number): void {
    if (!this.ctx || !this.helicopterGain) return;
    this.helicopterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime, 0.15);
  }

  public stopHelicopterAudio(fadeSec = 2.0): void {
    if (!this.ctx || !this.helicopterGain) return;
    const now = this.ctx.currentTime;
    this.helicopterGain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
    setTimeout(() => {
      try {
        this.helicopterOsc1?.stop();
        this.helicopterOsc2?.stop();
        this.helicopterOsc1?.disconnect();
        this.helicopterOsc2?.disconnect();
        this.helicopterGain?.disconnect();
      } catch {
        // ignore
      }
      this.helicopterOsc1 = null;
      this.helicopterOsc2 = null;
      this.helicopterGain = null;
    }, fadeSec * 1000 + 100);
  }

  /**
   * Synthesize distant storm thunder rumble with stereo roll
   */
  public playThunderRumble(volume = 0.55): void {
    if (!this.ctx) return;
    const duration = 2.8;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    // Brown noise integration for heavy low-frequency thunder
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.025 * white) / 1.025;
      lastOut = data[i];
      data[i] *= 3.5;
    }

    const thunderSource = this.ctx.createBufferSource();
    thunderSource.buffer = noiseBuffer;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, now);
    lp.frequency.exponentialRampToValueAtTime(65, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    thunderSource.connect(lp).connect(gain).connect(this.masterGain!);
    thunderSource.start(now);
  }

  /**
   * Speak military radio line via Web Speech API or radio fallback
   */
  public speakRadioLine(
    speaker: string,
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): void {
    this.speechQueue.push({ speaker, text, onStart, onEnd });
    if (!this.isSpeaking) {
      this.processNextSpeech();
    }
  }

  private processNextSpeech(): void {
    if (this.speechQueue.length === 0) {
      this.isSpeaking = false;
      return;
    }
    this.isSpeaking = true;
    const item = this.speechQueue.shift()!;
    this.playRadioSquelch('open');

    item.onStart?.();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const synth = window.speechSynthesis;
        const u = new SpeechSynthesisUtterance(item.text);
        // Tune pitch & rate based on tactical speaker callsign
        if (item.speaker.includes('COMMAND')) {
          u.pitch = 0.88;
          u.rate = 1.08;
        } else if (item.speaker.includes('GHOST')) {
          u.pitch = 0.76;
          u.rate = 1.15;
        } else if (item.speaker.includes('ROACH')) {
          u.pitch = 1.05;
          u.rate = 1.18;
        } else if (item.speaker.includes('PILOT')) {
          u.pitch = 0.95;
          u.rate = 1.12;
        } else {
          u.pitch = 1.0;
          u.rate = 1.1;
        }
        u.lang = 'en-US';

        u.onend = () => {
          this.playRadioSquelch('close');
          item.onEnd?.();
          setTimeout(() => this.processNextSpeech(), 180);
        };
        u.onerror = () => {
          this.playRadioSquelch('close');
          item.onEnd?.();
          setTimeout(() => this.processNextSpeech(), 100);
        };
        synth.speak(u);
        return;
      } catch {
        // Fallback to simulated duration
      }
    }

    // Fallback if speechSynthesis is not available or blocked:
    const approxDurationMs = Math.max(1200, item.text.length * 60);
    setTimeout(() => {
      this.playRadioSquelch('close');
      item.onEnd?.();
      setTimeout(() => this.processNextSpeech(), 150);
    }, approxDurationMs);
  }

  /**
   * Mechanical Gunsmith Ratchet / Click / Slide Sound (Web Audio synthesized)
   */
  public playMechanicalGunsmithClick(type: 'mount' | 'unmount' | 'slide' = 'mount'): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'mount') {
      // Crisp metallic double-click
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.05);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.07);

      // Follow-up latch
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2400, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(800, now + 0.09);
      gain2.gain.setValueAtTime(0.28, now + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc2.connect(gain2);
      gain2.connect(this.masterGain!);
      osc2.start(now + 0.04);
      osc2.stop(now + 0.11);
    } else {
      // Quick detach metallic click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.04);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  /**
   * Emergency Air-Raid Siren (Two-tone modulated wave)
   */
  public playEmergencySiren(durationSec = 6.0): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    // Frequency sweeps between 450Hz and 750Hz
    for (let t = 0; t < durationSec; t += 1.8) {
      osc.frequency.setValueAtTime(480, now + t);
      osc.frequency.linearRampToValueAtTime(760, now + t + 0.9);
      osc.frequency.linearRampToValueAtTime(480, now + t + 1.8);
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.8);
    gain.gain.setValueAtTime(0.28, now + durationSec - 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(filter).connect(gain).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + durationSec);
  }

  /**
   * Heavy Ballistic Shield Metal Ricochet / Deflection
   */
  public playHeavyShieldImpact(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // High resonant metallic ping
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2800, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.18);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.22);
    this.playWhiteNoiseBurst(0.025, 0.2);
  }

  /**
   * Juggernaut Shield Concussion / Stagger Breached
   */
  public playJuggernautStagger(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Deep sub-bass crunch + ringing bell
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain).connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.45);
    this.playWhiteNoiseBurst(0.12, 0.45);
  }

  /**
   * Green Extraction Smoke Flare Ignition Hiss
   */
  public playGreenSmokeIgnition(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Pop followed by prolonged hiss
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(320, now);
    popOsc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    popGain.gain.setValueAtTime(0.4, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    popOsc.connect(popGain).connect(this.masterGain!);
    popOsc.start(now);
    popOsc.stop(now + 0.09);

    this.playWhiteNoiseBurst(1.8, 0.25);
  }
}


export const tacticalRadioAudio = new TacticalRadioAudioEngine();
