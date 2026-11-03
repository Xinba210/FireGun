import * as THREE from 'three';

export interface InfiltrationCameraKeyframe {
  timeSec: number;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  camLabel?: string;
  radioText?: string;
  radioSpeaker?: string;
}

export class InfiltrationDirector {
  private camera: THREE.PerspectiveCamera;
  private isPlaying = false;
  private elapsedSec = 0;
  private totalDurationSec = 6.2;
  private onCompleteCallback: (() => void) | null = null;
  private onFrameCallback: ((t: number) => void) | null = null;

  private cutsceneOverlay: HTMLElement | null = null;
  private camLabelEl: HTMLElement | null = null;
  private radioSpeakerEl: HTMLElement | null = null;
  private radioTextEl: HTMLElement | null = null;
  private bootTextEl: HTMLElement | null = null;
  private clockEl: HTMLElement | null = null;
  private keyframes: InfiltrationCameraKeyframe[] = [];

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
            <span id="cutscene-cam-label" class="cutscene-rec-label">RECON CAM 01 // CRANE TOWER OVERLOOK</span>
          </div>
          <span class="cutscene-timestamp" id="cutscene-clock">02:40:12:04</span>
        </div>
        <div class="cutscene-letterbox cutscene-letterbox-bottom">
          <div class="cutscene-radio-sub" id="cutscene-radio">
            <span class="radio-speaker" id="cutscene-radio-speaker">[COMMAND]</span>
            <span class="radio-text" id="cutscene-radio-text">"SAT-RECON live. Storm is masking our insertion footprint."</span>
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
      // Act 1: High Crane Tower Overlook
      {
        timeSec: 0.0,
        pos: new THREE.Vector3(-14.0, 26.0, 18.0),
        target: new THREE.Vector3(-4.0, 4.0, -14.0),
        fov: 72,
        camLabel: 'RECON CAM 01 // CRANE TOWER OVERLOOK',
        radioSpeaker: '[COMMAND]',
        radioText: '"SAT-RECON live. Storm is masking our insertion footprint."',
      },
      // Act 2: Cargo Ship Antonov Quay
      {
        timeSec: 1.8,
        pos: new THREE.Vector3(-18.5, 4.2, 10.0),
        target: new THREE.Vector3(-24.0, 6.5, -12.0),
        fov: 64,
        camLabel: 'RECON CAM 02 // CARGO QUAY · ANTONOV BERTH 4',
        radioSpeaker: '[GHOST]',
        radioText: '"Vessel moored at Berth 4. Sentry patrols on perimeter."',
      },
      // Act 3: Catwalk Alley & Inner Yard Corridor
      {
        timeSec: 3.2,
        pos: new THREE.Vector3(4.5, 5.8, 6.0),
        target: new THREE.Vector3(-4.5, 2.0, 16.0),
        fov: 62,
        camLabel: 'RECON CAM 03 // CATWALK ALLEY · ALPHA LANE',
        radioSpeaker: '[ROACH]',
        radioText: '"Alley clear. Terminal security in standby mode."',
      },
      // Act 4: Zoom down and focus on Protagonist & Squad at covered LZ!
      {
        timeSec: 4.5,
        pos: new THREE.Vector3(-6.5, 2.35, 27.8),
        target: new THREE.Vector3(-6.5, 1.45, 24.0),
        fov: 66,
        camLabel: 'STRIKER-1 // OPERATOR INFILTRATION CONFIRMED',
        radioSpeaker: '[COMMAND]',
        radioText: '"Striker-1, you are green to execute. Secure the terminal and munitions."',
      },
      // Act 5: Smooth push into Protagonist Helmet Visor
      {
        timeSec: 5.6,
        pos: new THREE.Vector3(-6.5, 1.76, 25.0),
        target: new THREE.Vector3(-6.5, 1.72, 12.0),
        fov: 62,
        camLabel: 'OPTICAL LINK // VISOR SYNC COMPLETE',
        radioSpeaker: '[STRIKER-1]',
        radioText: '"Copy, Command. Moving in."',
      },
      // Final Ready Keyframe
      {
        timeSec: 6.2,
        pos: new THREE.Vector3(-6.5, 1.72, 24.0),
        target: new THREE.Vector3(-6.5, 1.72, 8.0),
        fov: 60,
        camLabel: 'SYSTEM READY // WEAPONS HOT',
        radioSpeaker: '[STRIKER-1]',
        radioText: '"Weapons hot. Engaging on my mark."',
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

    // Show HUD boot lines during the final helmet push (t >= 4.8s)
    if (t >= 4.8 && this.bootTextEl && this.bootTextEl.classList.contains('hidden')) {
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

    // Update camera label & radio text on segment change
    if (k0.camLabel && this.camLabelEl && this.camLabelEl.textContent !== k0.camLabel) {
      this.camLabelEl.textContent = k0.camLabel;
    }
    if (k0.radioSpeaker && this.radioSpeakerEl && this.radioSpeakerEl.textContent !== k0.radioSpeaker) {
      this.radioSpeakerEl.textContent = k0.radioSpeaker;
    }
    if (k0.radioText && this.radioTextEl && this.radioTextEl.textContent !== k0.radioText) {
      this.radioTextEl.textContent = k0.radioText;
    }

    const duration = Math.max(0.001, k1.timeSec - k0.timeSec);
    const alpha = Math.min(1, Math.max(0, (t - k0.timeSec) / duration));
    // Smooth easeInOutCubic
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
}
