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
  private totalDurationSec = 62.0;
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
  public helicopterPitch = 0.08;
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
            <span class="radio-text" id="cutscene-radio-text">"Holding 35 feet off the deck. West container berm LZ in sight."</span>
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
      // Act 1 (0.0s ~ 14.0s): Maritime low-altitude skimming cruise over stormy sea
      {
        timeSec: 0.0,
        pos: new THREE.Vector3(-28.0, 22.0, 130.0),
        target: new THREE.Vector3(-16.0, 16.0, 110.0),
        fov: 65,
        camLabel: 'INFIL-BIRD // LOW-ALTITUDE MARITIME CRUISE (02:40)',
        radioSpeaker: '[PILOT]',
        radioText: '"Holding 35 feet off the deck. Pacific Fleet Recon vector 0-4-0 engaged."',
        cabinLight: 'red',
      },
      // Act 2 (14.0s ~ 26.0s): Approaching harbor breakwater, distant cranes silhouette & storm
      {
        timeSec: 14.0,
        pos: new THREE.Vector3(-22.0, 18.0, 85.0),
        target: new THREE.Vector3(-12.0, 14.0, 60.0),
        fov: 64,
        camLabel: 'APPROACHING BREAKWATER // RADAR EVASION',
        radioSpeaker: '[COMMAND]',
        radioText: '"Command to Task Force 141. Satellite confirms heavy PMC lockdown on Basin 4."',
        cabinLight: 'red',
      },
      // Act 3 (26.0s ~ 38.0s): Harbor breach & searchlight avoidance
      {
        timeSec: 26.0,
        pos: new THREE.Vector3(-16.0, 12.0, 50.0),
        target: new THREE.Vector3(-8.0, 9.0, 36.0),
        fov: 66,
        camLabel: 'PORT PERIMETER // SEARCHLIGHT EVASION',
        radioSpeaker: '[GHOST]',
        radioText: '"Passing outer buoy. Watch the catwalks. PMC sniper teams on the gantry crane."',
        cabinLight: 'red',
      },
      // Act 4 (38.0s ~ 48.0s): Container alley flare deceleration & LZ approach
      {
        timeSec: 38.0,
        pos: new THREE.Vector3(-12.0, 6.5, 30.0),
        target: new THREE.Vector3(-6.5, 5.0, 25.5),
        fov: 68,
        camLabel: 'DROP ZONE // FINAL DECELERATION FLARE',
        radioSpeaker: '[PILOT]',
        radioText: '"Container corridor in sight. Braking hard. 10 seconds to insertion."',
        cabinLight: 'red',
      },
      // Act 5 (48.0s ~ 54.0s): Low hover, green light on, fast-ropes drop
      {
        timeSec: 48.0,
        pos: new THREE.Vector3(-9.5, 3.2, 25.5),
        target: new THREE.Vector3(-6.5, 2.8, 24.5),
        fov: 62,
        camLabel: 'DROP ZONE CONFIRMED // GREEN LIGHT ENGAGED',
        radioSpeaker: '[GHOST]',
        radioText: '"Green light! Go, go, go! Deploy ropes! Disembark!"',
        cabinLight: 'green',
      },
      // Act 6 (54.0s ~ 58.0s): Touchdown impact & perimeter security established
      {
        timeSec: 54.0,
        pos: new THREE.Vector3(-6.5, 1.72, 24.0),
        target: new THREE.Vector3(-6.5, 2.6, 22.0),
        fov: 62,
        camLabel: 'TOUCHDOWN // INSERTION FOOTPRINT ZERO',
        radioSpeaker: '[PILOT]',
        radioText: '"Boots on deck. Infil-Bird dusting off to carrier. Good hunting 141!"',
        cabinLight: 'off',
      },
      // Act 7 (58.0s ~ 62.0s): Helicopter roars away over crane, HUD firmware online, weapons free
      {
        timeSec: 58.0,
        pos: new THREE.Vector3(-6.5, 1.72, 24.0),
        target: new THREE.Vector3(-6.5, 1.72, 10.0),
        fov: 60,
        camLabel: 'SYSTEM READY // WEAPONS HOT',
        radioSpeaker: '[COMMAND]',
        radioText: '"Weapons free. Execute Operation Cold Harbor!"',
        cabinLight: 'off',
      },
      {
        timeSec: 62.0,
        pos: new THREE.Vector3(-6.5, 1.72, 24.0),
        target: new THREE.Vector3(-6.5, 1.72, 8.0),
        fov: 60,
        camLabel: 'SYSTEM READY // WEAPONS HOT',
        radioSpeaker: '[COMMAND]',
        radioText: '"Move out."',
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
    tacticalRadioAudio.startHelicopterAudio(0.42);
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

    // Update helicopter position along insertion flight path
    if (t < 26.0) {
      // Act 1 & 2: Gliding across water toward harbor
      const p = t / 26.0;
      this.helicopterPos.set(
        THREE.MathUtils.lerp(-24.0, -16.0, p),
        THREE.MathUtils.lerp(22.0, 12.0, p),
        THREE.MathUtils.lerp(120.0, 52.0, p)
      );
      this.helicopterRotY = -0.15 * (1 - p);
      this.helicopterPitch = 0.06; // nose slightly down while flying forward
    } else if (t < 38.0) {
      // Act 3: Flare and begin deceleration approach
      const p = (t - 26.0) / 12.0;
      this.helicopterPos.set(
        THREE.MathUtils.lerp(-16.0, -10.0, p),
        THREE.MathUtils.lerp(12.0, 6.0, p),
        THREE.MathUtils.lerp(52.0, 30.0, p)
      );
      this.helicopterRotY = 0;
      this.helicopterPitch = -0.04 * (1 - p); // flare nose up to brake!
    } else if (t < 48.0) {
      // Act 4: Precision deceleration over container alley LZ
      const p = (t - 38.0) / 10.0;
      this.helicopterPos.set(
        THREE.MathUtils.lerp(-10.0, -6.5, p),
        THREE.MathUtils.lerp(6.0, 3.5, p),
        THREE.MathUtils.lerp(30.0, 24.5, p)
      );
      this.helicopterRotY = 0;
      this.helicopterPitch = -0.05 * (1 - p);
    } else if (t < 54.0) {
      // Act 5: Low-hover insertion hold (gentle rotor wash bob)
      this.helicopterPos.set(-6.5, 3.2 + Math.sin(t * 7) * 0.05, 24.5);
      this.helicopterRotY = 0;
      this.helicopterPitch = 0;
    } else {
      // Act 6 & 7: Helicopter lifts off, pitches nose down, and roars away into stormy ocean!
      const p = (t - 54.0) / 8.0;
      this.helicopterPos.set(
        -6.5 + p * 38.0,
        3.2 + p * 42.0,
        24.5 - p * 65.0
      );
      this.helicopterRotY = p * 0.45;
      this.helicopterPitch = 0.16; // nose down accelerating forward!
      tacticalRadioAudio.setHelicopterVolume(Math.max(0.01, 0.42 * (1 - p)));
    }

    // Show HUD boot lines during the final weapon rack (t >= 58.0s)
    if (t >= 58.0 && this.bootTextEl && this.bootTextEl.classList.contains('hidden')) {
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

  public get showProtagonistMesh(): boolean {
    return false;
  }
}

export class EvacuationDirector {
  private camera: THREE.PerspectiveCamera;
  private isPlaying = false;
  private elapsedSec = 0;
  private totalDurationSec = 16.0;
  private onCompleteCallback: (() => void) | null = null;
  private onFrameCallback: ((t: number) => void) | null = null;

  private cutsceneOverlay: HTMLElement | null = null;
  private camLabelEl: HTMLElement | null = null;
  private radioSpeakerEl: HTMLElement | null = null;
  private radioTextEl: HTMLElement | null = null;

  // Helicopter motion state for evacuation
  public helicopterPos = new THREE.Vector3(-18, 18, 70);
  public helicopterRotY = Math.PI * 0.95;
  public helicopterPitch = 0.05;
  public flaresActive = false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.createDom();
  }

  private createDom() {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('cutscene-evacuation');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cutscene-evacuation';
      overlay.className = 'cutscene-overlay hidden';
      overlay.innerHTML = `
        <div class="cutscene-vignette"></div>
        <div class="cutscene-letterbox cutscene-letterbox-top">
          <div class="cutscene-rec-chip">
            <span class="cutscene-rec-dot" style="background:#22c55e;box-shadow:0 0 10px #22c55e"></span>
            <span id="evac-cam-label" class="cutscene-rec-label">HOT-EXTRACT // WEST HELIPAD LZ-DELTA</span>
          </div>
          <span class="cutscene-timestamp">EVAC IN PROGRESS</span>
        </div>
        <div class="cutscene-letterbox cutscene-letterbox-bottom">
          <div class="cutscene-radio-sub">
            <span class="radio-speaker" id="evac-radio-speaker">[PILOT]</span>
            <span class="radio-text" id="evac-radio-text">"Dustoff on the deck! Move move move!"</span>
          </div>
          <button id="btn-skip-evac" class="btn-skip-cutscene">SKIP [SPACE / TAP]</button>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.cutsceneOverlay = overlay;
    this.camLabelEl = document.getElementById('evac-cam-label');
    this.radioSpeakerEl = document.getElementById('evac-radio-speaker');
    this.radioTextEl = document.getElementById('evac-radio-text');

    document.getElementById('btn-skip-evac')?.addEventListener('click', () => {
      this.skip();
    });

    window.addEventListener('keydown', (e) => {
      if (this.isPlaying && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        this.skip();
      }
    });
  }

  public play(onComplete?: () => void, onFrame?: (t: number) => void) {
    this.isPlaying = true;
    this.elapsedSec = 0;
    this.onCompleteCallback = onComplete || null;
    this.onFrameCallback = onFrame || null;

    if (this.cutsceneOverlay) {
      this.cutsceneOverlay.classList.remove('hidden');
    }

    tacticalRadioAudio.initAudio().then(() => {
      tacticalRadioAudio.startHelicopterAudio();
      tacticalRadioAudio.speakRadioLine('PILOT', 'Dustoff on the deck! Move move move!');
    });
  }

  public update(dt: number): boolean {
    if (!this.isPlaying) return false;
    this.elapsedSec += dt;
    const t = this.elapsedSec;

    if (this.onFrameCallback) {
      this.onFrameCallback(t);
    }

    if (t >= this.totalDurationSec) {
      this.finish();
      return false;
    }

    // Act 1: 0.0s - 4.5s (Helicopter low approach & flare release)
    if (t < 4.5) {
      const p = t / 4.5;
      this.flaresActive = t > 2.0;
      this.helicopterPos.set(-18, THREE.MathUtils.lerp(18, 1.8, p), THREE.MathUtils.lerp(70, 38, p));
      this.helicopterPitch = THREE.MathUtils.lerp(0.22, 0.0, p);
      this.camera.position.set(-13, 2.5, 30);
      this.camera.lookAt(-18, 2.2, 38);
      this.camera.fov = 65;
      if (t > 1.2 && this.radioSpeakerEl && this.radioSpeakerEl.textContent !== '[PILOT]') {
        this.radioSpeakerEl.textContent = '[PILOT]';
        if (this.radioTextEl) this.radioTextEl.textContent = '"Infil-Bird on final approach! Defensive flares away! LZ hot!"';
        tacticalRadioAudio.speakRadioLine('PILOT', 'Infil-Bird on final approach! Defensive flares away! LZ hot!');
      }
    }
    // Act 2: 4.5s - 9.0s (Player & squad sprint onto cabin)
    else if (t < 9.0) {
      const p = (t - 4.5) / 4.5;
      this.flaresActive = false;
      if (t > 4.6 && this.radioSpeakerEl && this.radioSpeakerEl.textContent !== '[GHOST]') {
        this.radioSpeakerEl.textContent = '[GHOST]';
        if (this.radioTextEl) this.radioTextEl.textContent = '"Grab my hand! Everyone aboard! Roach, watch our six!"';
        tacticalRadioAudio.speakRadioLine('GHOST', 'Grab my hand! Everyone aboard! Roach, watch our six!');
      }
      this.helicopterPos.set(-18, 1.8, 38);
      this.helicopterPitch = 0.0;
      this.camera.position.set(
        THREE.MathUtils.lerp(-13, -17.5, p),
        THREE.MathUtils.lerp(2.5, 2.4, p),
        THREE.MathUtils.lerp(30, 38.2, p)
      );
      this.camera.lookAt(-18.2, 2.4, 38.2);
      this.camera.fov = 68;
    }
    // Act 3: 9.0s - 16.0s (Helicopter lift-off, turbine roar, climb out into stormy sea)
    else {
      const p = (t - 9.0) / 7.0;
      if (t > 9.5 && this.radioSpeakerEl && this.radioSpeakerEl.textContent !== '[COMMAND]') {
        this.radioSpeakerEl.textContent = '[COMMAND]';
        if (this.radioTextEl) this.radioTextEl.textContent = '"Strike team is outbound. Depot confirmed destroyed. Outstanding work, Task Force 141."';
        tacticalRadioAudio.speakRadioLine('COMMAND', 'Strike team is outbound. Depot confirmed destroyed. Outstanding work, Task Force 141.');
      }
      this.helicopterPos.set(-18, THREE.MathUtils.lerp(1.8, 42, p * p), THREE.MathUtils.lerp(38, -60, p));
      this.helicopterPitch = THREE.MathUtils.lerp(0.0, -0.25, Math.min(1, p * 1.5));
      // Camera looks out cabin door back at the burning harbor dock
      this.camera.position.set(this.helicopterPos.x + 0.4, this.helicopterPos.y + 0.4, this.helicopterPos.z + 0.2);
      this.camera.lookAt(-5, 2, 20);
      this.camera.fov = 62;
    }

    this.camera.updateProjectionMatrix();
    return true;
  }

  public skip() {
    if (!this.isPlaying) return;
    this.finish();
  }

  private finish() {
    this.isPlaying = false;
    tacticalRadioAudio.stopHelicopterAudio(1.5);
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
}

