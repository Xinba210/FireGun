import { loadProgression } from './progression.ts';

export interface PreloadStatus {
  step: number;
  totalSteps: number;
  label: string;
  percent: number;
  hint: string;
}

export const TACTICAL_TIPS = [
  '提示：開啟 [Y] 陀螺儀瞄準可在手機微動手腕實現高精準度爆頭。',
  '提示：按住 [Z] 可召喚友軍小隊戰術指令輪盤，並進入 0.3x 戰術子彈時間。',
  '提示：隊員倒地後有 30 秒急救時間，靠近長按 [E] 即可重整戰線。',
  '提示：射擊懸空的 20 呎貨櫃吊索，可讓貨櫃墜落壓制下方敵軍巡邏隊。',
  '提示：裝備消音器可隱匿槍聲與火光，但在遠程穿透力略有衰減。',
  '提示：被子彈命中路燈會破壞局部照明，讓夜戰環境更利於夜視突入。',
];

export class GameScreensManager {
  private preloadContainer: HTMLElement | null = null;
  private preloadFill: HTMLElement | null = null;
  private preloadLabel: HTMLElement | null = null;
  private preloadPct: HTMLElement | null = null;
  private preloadHint: HTMLElement | null = null;
  private pauseModal: HTMLElement | null = null;
  private recordsModal: HTMLElement | null = null;
  private titleOverlay: HTMLElement | null = null;
  private tipIdx = 0;
  private tipInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.createDomElements();
  }

  private createDomElements() {
    if (typeof document === 'undefined') return;

    // 1. Preload Screen (Ultra-Clean Fine Loading Line)
    let pScreen = document.getElementById('screen-preload');
    if (!pScreen) {
      pScreen = document.createElement('div');
      pScreen.id = 'screen-preload';
      pScreen.className = 'screen-preload-overlay';
      pScreen.innerHTML = `
        <div class="preload-bg-silhouette"></div>
        <div class="preload-line-track">
          <div id="preload-line-fill" class="preload-line-fill"></div>
        </div>
        <div class="preload-content-center">
          <div class="preload-badge-title">THE PORT FORTRESS // WARMING UP ENGINE</div>
          <div class="preload-stage-row">
            <span id="preload-stage-label" class="preload-stage-label">STEP 1/7 · DOWNLOADING ASSETS...</span>
            <span id="preload-stage-pct" class="preload-stage-pct">0%</span>
          </div>
          <div id="preload-stage-hint" class="preload-stage-hint">${TACTICAL_TIPS[0]}</div>
        </div>
      `;
      document.body.appendChild(pScreen);
    }
    this.preloadContainer = pScreen;
    this.preloadFill = document.getElementById('preload-line-fill');
    this.preloadLabel = document.getElementById('preload-stage-label');
    this.preloadPct = document.getElementById('preload-stage-pct');
    this.preloadHint = document.getElementById('preload-stage-hint');

    // 2. Title Screen Overlay (Rain Falling, Any Key to Deploy with White Flash)
    let tScreen = document.getElementById('screen-title');
    if (!tScreen) {
      tScreen = document.createElement('div');
      tScreen.id = 'screen-title';
      tScreen.className = 'screen-title-overlay hidden';
      tScreen.innerHTML = `
        <div class="title-vignette"></div>
        <div class="title-hero-block">
          <div class="title-sub-code">FIREGUN MILITARY SIMULATION // PFT-08</div>
          <h1 class="title-main-h1">THE PORT FORTRESS</h1>
          <div class="title-hazard-bar"></div>
          <p class="title-desc-p">OPERATION MIDNIGHT RECON — COLD HARBOR QUAY</p>
          <button id="btn-title-deploy" class="btn-deploy-start">
            <span class="btn-deploy-pulse"></span>
            DEPLOY OPERATOR // 點擊進入作戰
          </button>
          <div class="title-deploy-hint">PRESS ANY KEY OR TAP SCREEN TO DEPLOY</div>
        </div>
      `;
      document.body.appendChild(tScreen);
    }
    this.titleOverlay = tScreen;

    // 3. Pause Menu (Esc or Mobile Gear Icon)
    let pauseEl = document.getElementById('screen-pause');
    if (!pauseEl) {
      pauseEl = document.createElement('div');
      pauseEl.id = 'screen-pause';
      pauseEl.className = 'screen-pause-overlay hidden';
      pauseEl.innerHTML = `
        <div class="pause-card">
          <div class="pause-header">
            <span class="pause-title">PAUSED // 作戰暫停</span>
            <span class="pause-code">GRID K2 · PACIFIC TIME 02:40</span>
          </div>
          <div class="pause-actions">
            <button id="btn-pause-resume" class="btn-pause-act btn-pause-primary">RESUME OPERATION // 繼續作戰</button>
            <button id="btn-pause-records" class="btn-pause-act">RECORDS // 作戰紀錄與成就</button>
            <button id="btn-pause-restart" class="btn-pause-act">RESTART MISSION // 重新開始</button>
            <button id="btn-pause-main" class="btn-pause-act btn-pause-danger">MAIN MENU // 返回主畫面</button>
          </div>
          <div class="pause-footer-tip">[Esc] 鍵或點擊繼續即可立即恢復行動</div>
        </div>
      `;
      document.body.appendChild(pauseEl);
    }
    this.pauseModal = pauseEl;

    // 4. Records Modal
    let recEl = document.getElementById('screen-records');
    if (!recEl) {
      recEl = document.createElement('div');
      recEl.id = 'screen-records';
      recEl.className = 'screen-records-overlay hidden';
      recEl.innerHTML = `
        <div class="records-card">
          <div class="records-header">
            <h2 class="records-h2">OPERATOR COMBAT LOG // 作戰紀錄</h2>
            <button id="btn-records-close" class="btn-records-x">✕</button>
          </div>
          <div class="records-grid">
            <div class="rec-stat-box">
              <span class="rec-label">總殲敵數</span>
              <b id="rec-total-kills" class="rec-val">0</b>
            </div>
            <div class="rec-stat-box">
              <span class="rec-label">精準爆頭數</span>
              <b id="rec-total-hs" class="rec-val">0</b>
            </div>
            <div class="rec-stat-box">
              <span class="rec-label">最佳突襲通關</span>
              <b id="rec-best-raid" class="rec-val">--</b>
            </div>
            <div class="rec-stat-box">
              <span class="rec-label">波次生存最高</span>
              <b id="rec-best-wave" class="rec-val">WAVE 1</b>
            </div>
          </div>
          <div class="records-footer">
            <button id="btn-records-back" class="btn-gold" style="width:100%;padding:10px">關閉紀錄</button>
          </div>
        </div>
      `;
      document.body.appendChild(recEl);
    }
    this.recordsModal = recEl;

    this.startTipRotation();
  }

  private startTipRotation() {
    if (this.tipInterval) clearInterval(this.tipInterval);
    this.tipInterval = setInterval(() => {
      this.tipIdx = (this.tipIdx + 1) % TACTICAL_TIPS.length;
      if (this.preloadHint) {
        this.preloadHint.textContent = TACTICAL_TIPS[this.tipIdx];
      }
    }, 2800);
  }

  public updatePreload(status: PreloadStatus) {
    if (this.preloadFill) {
      this.preloadFill.style.width = `${Math.min(100, Math.max(0, status.percent))}%`;
    }
    if (this.preloadLabel) {
      this.preloadLabel.textContent = `STEP ${status.step}/${status.totalSteps} · ${status.label}`;
    }
    if (this.preloadPct) {
      this.preloadPct.textContent = `${Math.round(status.percent)}%`;
    }
    if (this.preloadHint && status.hint) {
      this.preloadHint.textContent = status.hint;
    }
  }

  public hidePreload() {
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
      this.tipInterval = null;
    }
    if (this.preloadContainer) {
      this.preloadContainer.style.opacity = '0';
      setTimeout(() => this.preloadContainer?.classList.add('hidden'), 450);
    }
  }

  public showTitleScreen(onDeploy: () => void) {
    if (!this.titleOverlay) return;
    this.titleOverlay.classList.remove('hidden');
    const deploy = () => {
      this.triggerWhiteFlash(() => {
        this.titleOverlay?.classList.add('hidden');
        onDeploy();
      });
    };
    document.getElementById('btn-title-deploy')?.addEventListener('click', deploy, { once: true });
    const keyDeploy = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        window.removeEventListener('keydown', keyDeploy);
        deploy();
      }
    };
    window.addEventListener('keydown', keyDeploy);
  }

  public triggerWhiteFlash(onComplete?: () => void) {
    const flash = document.createElement('div');
    flash.className = 'full-white-flash';
    document.body.appendChild(flash);
    requestAnimationFrame(() => {
      flash.style.opacity = '1';
      setTimeout(() => {
        flash.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(flash);
          onComplete?.();
        }, 300);
      }, 160);
    });
  }

  public togglePause(show?: boolean): boolean {
    if (!this.pauseModal) return false;
    const isVisible = show !== undefined ? show : this.pauseModal.classList.contains('hidden');
    this.pauseModal.classList.toggle('hidden', !isVisible);
    return isVisible;
  }

  public isPaused(): boolean {
    return this.pauseModal ? !this.pauseModal.classList.contains('hidden') : false;
  }

  public showRecords() {
    if (!this.recordsModal) return;
    const p = loadProgression();
    const kEl = document.getElementById('rec-total-kills');
    const hEl = document.getElementById('rec-total-hs');
    const rEl = document.getElementById('rec-best-raid');
    const wEl = document.getElementById('rec-best-wave');
    if (kEl) kEl.textContent = String(p.stats.totalKills);
    if (hEl) hEl.textContent = String(p.stats.totalHeadshots);
    if (rEl) {
      const mins = Math.floor(p.stats.bestRaidTimeSec / 60);
      const secs = String(p.stats.bestRaidTimeSec % 60).padStart(2, '0');
      rEl.textContent = `${mins}:${secs}`;
    }
    if (wEl) wEl.textContent = `WAVE ${p.stats.highestSurvivalWave}`;
    this.recordsModal.classList.remove('hidden');
  }

  public hideRecords() {
    this.recordsModal?.classList.add('hidden');
  }
}
