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
  private totalDurationSec = 24.0;
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
  public flaresActive = false;

  private hasTriggeredThreatAlert = false;
  private hasTriggeredFastRope = false;
  private hasTriggeredTouchdown = false;

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
          <div class="boot-line">TACTICAL VISOR FIRMWARE v1.8.2 ENGAGED...</div>
          <div class="boot-line">LZ SECURED: WEST CONTAINER BERM (31M TO PATROL ALPHA)</div>
          <div class="boot-line">SQUAD LINK: ACTIVE (GHOST & ROACH COVERING FLANK)</div>
          <div class="boot-line boot-green">STEALTH INSERTION CONFIRMED — FREE TO ENGAGE</div>
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
      // Act 1 (0.0s ~ 5.0s): High-speed low-altitude maritime surge (24m/s)
      {
        timeSec: 0.0,
        pos: new THREE.Vector3(-42.0, 26.0, 136.0),
        target: new THREE.Vector3(-22.0, 18.0, 95.0),
        fov: 62,
        camLabel: 'INFIL-BIRD // HIGH-SPEED STORMY INGRESS (24 M/S)',
        radioSpeaker: '[PILOT]',
        radioText: '"Falcon 1-1 entering combat sector. Skimming wave crests at 24 m/s. Secure payloads!"',
        cabinLight: 'red',
      },
      // Act 2 (5.0s ~ 11.0s): SAM Radar Ping, High-G Evasive Bank & Countermeasure Flares
      {
        timeSec: 5.0,
        pos: new THREE.Vector3(-38.0, 20.0, 88.0),
        target: new THREE.Vector3(-18.0, 14.0, 65.0),
        fov: 65,
        camLabel: 'THREAT WARNING // HOSTILE SAM LOCK DETECTED',
        radioSpeaker: '[OVERWATCH]',
        radioText: '"WARNING! SAM radar pinged from crane battery! BREAK RIGHT! DEPLOY COUNTERMEASURES!"',
        cabinLight: 'red',
      },
      // Act 3 (11.0s ~ 16.0s): Container Canyon Penetration, evading main avenue
      {
        timeSec: 11.0,
        pos: new THREE.Vector3(-28.0, 12.0, 52.0),
        target: new THREE.Vector3(-18.0, 8.0, 38.0),
        fov: 64,
        camLabel: 'PORT PERIMETER // DIVERTING TO WEST BERM LZ',
        radioSpeaker: '[COMMAND]',
        radioText: '"141, divert to Western Container Berm LZ. Hostile patrol Alpha is in the main alley. Silent insertion only."',
        cabinLight: 'red',
      },
      // Act 4 (16.0s ~ 20.0s): Flare deceleration & hover over Western Berm, fast-rope deploy
      {
        timeSec: 16.0,
        pos: new THREE.Vector3(-19.5, 4.8, 34.0),
        target: new THREE.Vector3(-18.5, 2.8, 30.5),
        fov: 62,
        camLabel: 'SAFE DROP ZONE CONFIRMED // GREEN LIGHT ENGAGED',
        radioSpeaker: '[GHOST]',
        radioText: '"Green light! Deploy fast-ropes! Drop into the blind alley!"',
        cabinLight: 'green',
      },
      // Act 5 (20.0s ~ 24.0s): Touchdown behind containers, boots on ground, helicopter dust-off
      {
        timeSec: 20.0,
        pos: new THREE.Vector3(-18.5, 1.72, 30.5),
        target: new THREE.Vector3(-18.5, 2.0, 24.0),
        fov: 60,
        camLabel: 'TOUCHDOWN // INSERTION FOOTPRINT ZERO (CONCEALED)',
        radioSpeaker: '[PILOT]',
        radioText: '"Boots on deck. Falcon 1-1 dusting off to sea. Good hunting 141!"',
        cabinLight: 'off',
      },
      {
        timeSec: 24.0,
        pos: new THREE.Vector3(-18.5, 1.72, 30.5),
        target: new THREE.Vector3(-18.5, 1.72, 12.0),
        fov: 60,
        camLabel: 'SYSTEM READY // WEAPONS HOT // RECON PHASE',
        radioSpeaker: '[COMMAND]',
        radioText: '"LZ secure behind container stack. Weapons free. Move out silent."',
        cabinLight: 'off',
      },
    ];
  }

  public play(onComplete: () => void, onFrame?: (t: number) => void) {
    this.isPlaying = true;
    this.elapsedSec = 0;
    this.hasTriggeredThreatAlert = false;
    this.hasTriggeredFastRope = false;
    this.hasTriggeredTouchdown = false;
    this.flaresActive = false;
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

    // Dynamic landing coordinates based on targetSpawnPos (fallback to Western Container Berm)
    const destX = targetSpawnPos ? targetSpawnPos.x : -18.5;
    const destY = targetSpawnPos ? targetSpawnPos.y : 0.0;
    const destZ = targetSpawnPos ? targetSpawnPos.z : 30.5;

    // Update real-time military timestamp
    if (this.clockEl) {
      const ms = Math.floor((t * 100) % 100);
      this.clockEl.textContent = `02:40:${String(12 + Math.floor(t)).padStart(2, '0')}:${String(ms).padStart(2, '0')}`;
    }

    // Dynamic High-Tension Audio & FX Triggers (High-Speed Ingress 24s)
    if (t >= 5.0 && t < 12.0) {
      this.flaresActive = true;
      if (!this.hasTriggeredThreatAlert) {
        this.hasTriggeredThreatAlert = true;
        tacticalRadioAudio.playRwrThreatAlarm(3.2);
        tacticalRadioAudio.playEmergencySiren(3.5);
      }
    } else {
      this.flaresActive = false;
    }

    if (t >= 16.0 && !this.hasTriggeredFastRope) {
      this.hasTriggeredFastRope = true;
      tacticalRadioAudio.playFastRopeDeploy();
    }

    if (t >= 20.0 && !this.hasTriggeredTouchdown) {
      this.hasTriggeredTouchdown = true;
      tacticalRadioAudio.playCombatTouchdown();
    }

    // High-Speed insertion flight path (22~24 m/s low altitude ingress)
    if (t < 11.0) {
      // Act 1 & 2: High-speed surge across stormy water, aggressive evasive jink at t >= 5.0
      const p = t / 11.0;
      const bankJink = t >= 5.0 ? Math.sin((t - 5.0) * 1.5) * 5.5 : 0;
      this.helicopterPos.set(
        THREE.MathUtils.lerp(-32.0, -20.0, p) + bankJink,
        THREE.MathUtils.lerp(24.0, 14.0, p),
        THREE.MathUtils.lerp(145.0, 60.0, p)
      );
      this.helicopterRotY = -0.22 * (1 - p) + (t >= 5.0 ? 0.35 : 0);
      this.helicopterPitch = 0.12; // aggressive nose-down acceleration!
    } else if (t < 16.0) {
      // Act 3: Low-altitude container canyon penetration
      const p = (t - 11.0) / 5.0;
      this.helicopterPos.set(
        THREE.MathUtils.lerp(-20.0, destX + 1.2, p),
        THREE.MathUtils.lerp(14.0, 5.5, p),
        THREE.MathUtils.lerp(60.0, destZ + 4.5, p)
      );
      this.helicopterRotY = 0;
      this.helicopterPitch = -0.08 * (1 - p); // aerodynamic pitch-up brake
    } else if (t < 20.0) {
      // Act 4: Dynamic Flare Deceleration & Fast-Rope Hover over Western Berm
      const p = (t - 16.0) / 4.0;
      this.helicopterPos.set(
        THREE.MathUtils.lerp(destX + 1.2, destX, p),
        THREE.MathUtils.lerp(5.5, 3.4, p),
        THREE.MathUtils.lerp(destZ + 4.5, destZ + 0.5, p)
      );
      this.helicopterRotY = 0;
      this.helicopterPitch = -0.12 * (1 - p);
    } else {
      // Act 5: Low-level touchdown hold & instant dust-off surge into stormy sea!
      const p = (t - 20.0) / 4.0;
      this.helicopterPos.set(
        destX - p * 42.0,
        3.4 + p * 35.0,
        (destZ + 0.5) + p * 65.0
      );
      this.helicopterRotY = -p * 0.45;
      this.helicopterPitch = 0.22; // full throttle nose-down roar away!
      tacticalRadioAudio.setHelicopterVolume(Math.max(0.01, 0.45 * (1 - p)));
    }

    // Show HUD boot lines during the final weapon rack (t >= 22.0s)
    if (t >= 22.0 && this.bootTextEl && this.bootTextEl.classList.contains('hidden')) {
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
    this.finish(new THREE.Vector3(-18.5, 1.72, 30.5));
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
    if (typeof document !== 'undefined') {
      document.getElementById('hud')?.classList.remove('hidden');
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

