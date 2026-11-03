import * as THREE from 'three';
import { tacticalRadioAudio } from './audio';

export interface InfiltrationCameraKeyframe {
  timeSec: number;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  camLabel?: string;
  radioText?: string;
  radioSpeaker?: string;
  cabinLight?: 'red' | 'green' | 'off';
}

export class InfiltrationDirector {
  private camera: THREE.PerspectiveCamera;
  private isPlaying = false;
  private elapsedSec = 0;
  private totalDurationSec = 6.5;
  private onCompleteCallback: (() => void) | null = null;
  private onFrameCallback: ((t: number) => void) | null = null;

  private cutsceneOverlay: HTMLElement | null = null;
  private camLabelEl: HTMLElement | null = null;
  private radioSpeakerEl: HTMLElement | null = null;
  private radioTextEl: HTMLElement | null = null;
  private bootTextEl: HTMLElement | null = null;
  private clockEl: HTMLElement | null = null;
  private jumpLightEl: HTMLElement | null = null;
  private keyframes: InfiltrationCameraKeyframe[] = [];

  // Helicopter motion state
  public helicopterPos = new THREE.Vector3(-15, 14, 52);
  public helicopterRotY = 0;
  public cabinLightColor = new THREE.Color('#ff2222');

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.createCutsceneDom();
    this.setupKeyframes();
  }

  private createCutsceneDom() {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('cutscene-infiltration');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cutscene-infiltration';
      overlay.className = 'cutscene-overlay hidden';
      overlay.innerHTML = `
        <div class="cutscene-vignette"></div>
        <div class="cutscene-letterbox cutscene-letterbox-top">
          <div class="cutscene-rec-chip">
            <span class="cutscene-rec-dot"></span>
            <span id="cutscene-cam-label" class="cutscene-rec-label">INFIL-BIRD // LOW-ALTITUDE RADAR EVASION</span>
          </div>
          <div class="cutscene-jump-light-indicator" id="cutscene-jump-light">
            <span class="jump-light-bulb red"></span>
            <span class="jump-light-text">STANDBY [RED LIGHT]</span>
          </div>
          <span class="cutscene-timestamp" id="cutscene-clock">02:40:12:04</span>
        </div>
        <div class="cutscene-letterbox cutscene-letterbox-bottom">
          <div class="cutscene-radio-sub" id="cutscene-radio">
            <span class="radio-speaker" id="cutscene-radio-speaker">[PILOT]</span>
            <span class="radio-text" id="cutscene-radio-text">"Holding at 25 feet. Weather is masking our rotor footprint."</span>
          </div>
          <button id="btn-skip-cutscene" class="btn-skip-cutscene">SKIP [SPACE / TAP]</button>
        </div>
        <div class="cutscene-hud-boot hidden" id="cutscene-hud-boot">
          <div class="boot-line">TACTICAL VISOR FIRMWARE v4.19 ENGAGED...</div>
          <div class="boot-line">OPTICS: ONLINE // BALLISTICS: SYNCED</div>
          <div class="boot-line">SQUAD LINK: ACTIVE (GHOST & ROACH ON SIX)</div>
          <div class="boot-line boot-green">WEAPONS FREE — YOU ARE GREEN TO ENGAGE</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.cutsceneOverlay = overlay;
    this.camLabelEl = document.getElementById('cutscene-cam-label');
    this.radioSpeakerEl = document.getElementById('cutscene-radio-speaker');
    this.radioTextEl = document.getElementById('cutscene-radio-text');
    this.bootTextEl = document.getElementById('cutscene-hud-boot');
    this.clockEl = document.getElementById('cutscene-clock');
    this.jumpLightEl = document.getElementById('cutscene-jump-light');

    document.getElementById('btn-skip-cutscene')?.addEventListener('click', () => {
      this.skip();
    });

    window.addEventListener('keydown', (e) => {
      if (this.isPlaying && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        this.skip();
      }
    });
  }

  private setupKeyframes() {
    this.keyframes = [
      // Act 1: Stealth helicopter skimming ocean waves through squall
      {
        timeSec: 0.0,
        pos: new THREE.Vector3(-18.0, 11.5, 46.0),
        target: new THREE.Vector3(-8.0, 4.0, 26.0),
        fov: 72,
        camLabel: 'INFIL-BIRD // LOW-ALTITUDE RADAR EVASION',
        radioSpeaker: '[PILOT]',
        radioText: '"Holding 25 feet off the deck. West container berm blind spot in sight."',
        cabinLight: 'red',
      },
      // Act 2: Cabin interior POV looking out open cargo door at rain & harbor
      {
        timeSec: 1.8,
        pos: new THREE.Vector3(-7.8, 5.0, 29.5),
        target: new THREE.Vector3(-6.5, 1.5, 23.0),
        fov: 65,
        camLabel: 'CABIN JUMP STATION // RED LIGHT ACTIVE',
        radioSpeaker: '[GHOST]',
        radioText: '"Check weapons. Dropping in behind the shipping containers. Pure stealth."',
        cabinLight: 'red',
      },
      // Act 3: Helicopter hovers low in container blindspot; green light kicks on!
      {
        timeSec: 3.5,
        pos: new THREE.Vector3(-6.8, 3.6, 25.4),
        target: new THREE.Vector3(-6.5, 1.2, 21.0),
        fov: 62,
        camLabel: 'DROP ZONE CONFIRMED // GREEN LIGHT ENGAGED',
        radioSpeaker: '[GHOST]',
        radioText: '"Green light! Go, go, go! Disembark!"',
        cabinLight: 'green',
      },
      // Act 4: Player jumps down to wet tarmac (camera drops with landing impulse)
      {
        timeSec: 4.8,
        pos: new THREE.Vector3(-6.5, 1.82, 24.2),
        target: new THREE.Vector3(-6.5, 1.5, 14.0),
        fov: 60,
        camLabel: 'TOUCHDOWN // INSERTION FOOTPRINT ZERO',
        radioSpeaker: '[PILOT]',
        radioText: '"Package delivered. Infil-Bird RTB to carrier."',
        cabinLight: 'off',
      },
      // Act 5: Slide cocking & Visor sync
      {
        timeSec: 5.6,
        pos: new THREE.Vector3(-6.5, 1.72, 24.0),
        target: new THREE.Vector3(-6.5, 1.72, 10.0),
        fov: 60,
        camLabel: 'SYSTEM READY // WEAPONS HOT',
        radioSpeaker: '[COMMAND]',
        radioText: '"Boots on the ground. Weapons free, execute Operation Cold Harbor!"',
        cabinLight: 'off',
      },
      // Final Ready Keyframe
      {
        timeSec: 6.5,
        pos: new THREE.Vector3(-6.5, 1.72, 24.0),
        target: new THREE.Vector3(-6.5, 1.72, 8.0),
        fov: 60,
        camLabel: 'SYSTEM READY // WEAPONS HOT',
        radioSpeaker: '[COMMAND]',
        radioText: '"Weapons free. Move out."',
        cabinLight: 'off',
      },
    ];
  }

  public play(onComplete: () => void, onFrame?: (t: number) => void) {
    this.isPlaying = true;
    this.elapsedSec = 0;
    this.onCompleteCallback = onComplete;
    this.onFrameCallback = onFrame || null;
    if (this.cutsceneOverlay) {
      this.cutsceneOverlay.classList.remove('hidden');
    }
    if (this.bootTextEl) {
      this.bootTextEl.classList.add('hidden');
    }
    tacticalRadioAudio.initAudio();
    tacticalRadioAudio.startHelicopterAudio(0.38);
  }

  public update(deltaSec: number, targetSpawnPos: THREE.Vector3): boolean {
    if (!this.isPlaying) return false;
    this.elapsedSec += deltaSec;
    const t = this.elapsedSec;

    if (this.onFrameCallback) {
      this.onFrameCallback(t);
    }

    // Update real-time military timestamp
    if (this.clockEl) {
      const ms = Math.floor((t * 100) % 100);
      this.clockEl.textContent = `02:40:${String(12 + Math.floor(t)).padStart(2, '0')}:${String(ms).padStart(2, '0')}`;
    }

    // Update helicopter position along insertion glide-path
    if (t < 3.8) {
      const p = t / 3.8;
      this.helicopterPos.set(
        THREE.MathUtils.lerp(-18, -6.5, p),
        THREE.MathUtils.lerp(12, 4.2, p),
        THREE.MathUtils.lerp(48, 24.5, p)
      );
      this.helicopterRotY = -0.15 * (1 - p);
    } else if (t < 4.8) {
      // Low hover flare
      this.helicopterPos.set(-6.5, 3.8 + Math.sin(t * 8) * 0.08, 24.5);
    } else {
      // Helicopter pulls up and banks away into the stormy night sky
      const p = (t - 4.8) / 1.7;
      this.helicopterPos.set(
        -6.5 + p * 24,
        3.8 + p * 22,
        24.5 - p * 38
      );
      this.helicopterRotY = p * 0.45;
      tacticalRadioAudio.setHelicopterVolume(Math.max(0.01, 0.38 * (1 - p)));
    }

    // Show HUD boot lines during the final weapon rack (t >= 5.2s)
    if (t >= 5.2 && this.bootTextEl && this.bootTextEl.classList.contains('hidden')) {
      this.bootTextEl.classList.remove('hidden');
    }

    if (t >= this.totalDurationSec) {
      this.finish(targetSpawnPos);
      return false;
    }

    // Find current active keyframe segment
    let k0 = this.keyframes[0];
    let k1 = this.keyframes[1];
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (t >= this.keyframes[i].timeSec && t <= this.keyframes[i + 1].timeSec) {
        k0 = this.keyframes[i];
        k1 = this.keyframes[i + 1];
        break;
      }
    }

    // Update UI elements
    if (k0.camLabel && this.camLabelEl && this.camLabelEl.textContent !== k0.camLabel) {
      this.camLabelEl.textContent = k0.camLabel;
    }
    if (k0.radioSpeaker && this.radioSpeakerEl && this.radioSpeakerEl.textContent !== k0.radioSpeaker) {
      this.radioSpeakerEl.textContent = k0.radioSpeaker;
    }
    if (k0.radioText && this.radioTextEl && this.radioTextEl.textContent !== k0.radioText) {
      this.radioTextEl.textContent = k0.radioText;
      tacticalRadioAudio.speakRadioLine(k0.radioSpeaker || 'RADIO', k0.radioText || '');
    }

    // Jump light
    if (this.jumpLightEl) {
      if (k0.cabinLight === 'green') {
        this.cabinLightColor.set('#22c55e');
        this.jumpLightEl.innerHTML = `<span class="jump-light-bulb green"></span><span class="jump-light-text green">JUMP [GREEN LIGHT]</span>`;
      } else if (k0.cabinLight === 'red') {
        this.cabinLightColor.set('#ff2222');
        this.jumpLightEl.innerHTML = `<span class="jump-light-bulb red"></span><span class="jump-light-text">STANDBY [RED LIGHT]</span>`;
      } else {
        this.jumpLightEl.innerHTML = '';
      }
    }

    const duration = Math.max(0.001, k1.timeSec - k0.timeSec);
    const alpha = Math.min(1, Math.max(0, (t - k0.timeSec) / duration));
    const ease = alpha < 0.5 ? 4 * alpha * alpha * alpha : 1 - Math.pow(-2 * alpha + 2, 3) / 2;

    this.camera.position.lerpVectors(k0.pos, k1.pos, ease);
    const curTarget = new THREE.Vector3().lerpVectors(k0.target, k1.target, ease);
    this.camera.lookAt(curTarget);
    this.camera.fov = THREE.MathUtils.lerp(k0.fov, k1.fov, ease);
    this.camera.updateProjectionMatrix();

    return true;
  }

  public skip() {
    if (!this.isPlaying) return;
    this.finish(new THREE.Vector3(-6.5, 1.72, 24.0));
  }

  private finish(spawnPos: THREE.Vector3) {
    this.isPlaying = false;
    this.camera.position.set(spawnPos.x, 1.72, spawnPos.z);
    this.camera.fov = 60;
    this.camera.updateProjectionMatrix();

    tacticalRadioAudio.stopHelicopterAudio(1.2);

    if (this.cutsceneOverlay) {
      this.cutsceneOverlay.classList.add('hidden');
    }

    const cb = this.onCompleteCallback;
    this.onCompleteCallback = null;
    this.onFrameCallback = null;
    cb?.();
  }

  public get active(): boolean {
    return this.isPlaying;
  }

  public get currentElapsed(): number {
    return this.elapsedSec;
  }

  /**
   * NEVER display 3rd person full mesh in first person!
   */
  public get showProtagonistMesh(): boolean {
    return false;
  }
}
