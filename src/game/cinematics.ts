import * as THREE from 'three';

export interface InfiltrationCameraKeyframe {
  timeSec: number;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

export class InfiltrationDirector {
  private camera: THREE.PerspectiveCamera;
  private isPlaying = false;
  private elapsedSec = 0;
  private totalDurationSec = 3.8;
  private onCompleteCallback: (() => void) | null = null;
  private cutsceneOverlay: HTMLElement | null = null;
  private bootTextEl: HTMLElement | null = null;
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
          <span class="cutscene-rec-dot"></span>
          <span class="cutscene-rec-label">REC // SATELLITE TACTICAL FEED · OP-MIDNIGHT</span>
          <span class="cutscene-timestamp" id="cutscene-clock">02:41:35:12</span>
        </div>
        <div class="cutscene-letterbox cutscene-letterbox-bottom">
          <div class="cutscene-radio-sub" id="cutscene-radio">
            <span class="radio-speaker">[HQ RADIO]</span>
            <span class="radio-text">"Striker-1 on deck. Insertion confirmed. You are cleared hot."</span>
          </div>
          <button id="btn-skip-cutscene" class="btn-skip-cutscene">SKIP [SPACE / TAP]</button>
        </div>
        <div class="cutscene-hud-boot hidden" id="cutscene-hud-boot">
          <div class="boot-line">INITIALIZING TACTICAL VISOR FIRMWARE v4.19...</div>
          <div class="boot-line">NEURAL SENSORS: ONLINE</div>
          <div class="boot-line">OPTICAL RECON: CALIBRATED (60 FOV)</div>
          <div class="boot-line boot-green">WEAPON SYSTEMS: UNLOCKED — ENGAGE AT WILL</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    this.cutsceneOverlay = overlay;
    this.bootTextEl = document.getElementById('cutscene-hud-boot');

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
      {
        timeSec: 0.0,
        pos: new THREE.Vector3(-15, 22.0, 32),
        target: new THREE.Vector3(-6, 2.0, 10),
        fov: 75,
      },
      {
        timeSec: 1.4,
        pos: new THREE.Vector3(-10, 8.5, 24),
        target: new THREE.Vector3(-6.5, 1.7, 14),
        fov: 68,
      },
      {
        timeSec: 2.6,
        pos: new THREE.Vector3(-7.5, 2.4, 18),
        target: new THREE.Vector3(-6.5, 1.72, 10),
        fov: 64,
      },
      {
        timeSec: 3.8,
        pos: new THREE.Vector3(-6.5, 1.72, 16),
        target: new THREE.Vector3(-6.5, 1.72, 0),
        fov: 60,
      },
    ];
  }

  public play(onComplete: () => void) {
    this.isPlaying = true;
    this.elapsedSec = 0;
    this.onCompleteCallback = onComplete;
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

    // Update HUD Boot sequence at 2.4s
    if (this.elapsedSec >= 2.4 && this.bootTextEl && this.bootTextEl.classList.contains('hidden')) {
      this.bootTextEl.classList.remove('hidden');
    }

    if (this.elapsedSec >= this.totalDurationSec) {
      this.finish(targetSpawnPos);
      return false;
    }

    // Interpolate keyframes
    const t = this.elapsedSec;
    let k0 = this.keyframes[0];
    let k1 = this.keyframes[1];
    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (t >= this.keyframes[i].timeSec && t <= this.keyframes[i + 1].timeSec) {
        k0 = this.keyframes[i];
        k1 = this.keyframes[i + 1];
        break;
      }
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
    this.finish(new THREE.Vector3(-6.5, 1.72, 16));
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
    cb?.();
  }

  public get active(): boolean {
    return this.isPlaying;
  }
}
