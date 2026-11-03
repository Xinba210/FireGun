import { loadProgression, saveProgression } from './progression.ts';
import { calculateOperationRank, computeMatchRewards, type MatchStats, type MatchRewardResult } from './rewards.ts';

export interface PreloadStatus {
  step: number;
  totalSteps: number;
  label: string;
  percent: number;
  hint: string;
  mbLoaded?: number;
  mbTotal?: number;
}

export const TACTICAL_TIPS = [
  '提示：開啟 [Y] 陀螺儀瞄準可在手機微動手腕實現高精準度爆頭。',
  '提示：按住 [Z] 可召喚友軍小隊戰術指令輪盤，並進入 0.3x 戰術子彈時間。',
  '提示：隊員倒地後有 30 秒急救時間，靠近長按 [E] 即可重整戰線。',
  '提示：射擊懸空的 20 呎貨櫃吊索，可讓貨櫃墜落壓制下方敵軍巡邏隊。',
  '提示：裝備消音器可隱匿槍聲與火光，但在遠程穿透力略有衰減。',
  '提示：被子彈命中路燈會破壞局部照明，讓夜戰環境更利於夜視突入。',
];

export const RECON_SLIDES = [
  {
    title: 'CAM-01 // GANTRY CRANE PERIMETER',
    grid: 'GRID K-03 · ELEVATION 28m',
    desc: '重型門型吊車與懸吊 20 呎集裝箱區，注意高處狙擊手警戒視線。',
    visualClass: 'recon-slide-crane',
  },
  {
    title: 'CAM-02 // CARGO VESSEL ANTONOV QUAYSIDE',
    grid: 'GRID D-08 · MOORING PIER',
    desc: '萬噸貨輪泊位與潮濕舷梯通道，巡邏隊每 45 秒往返碼頭檢查哨。',
    visualClass: 'recon-slide-ship',
  },
  {
    title: 'CAM-03 // UNDERGROUND CATWALK & CONTAINER ALLEY',
    grid: 'GRID W-12 · INNER YARD',
    desc: '集裝箱迷宮與高架鋼構貓道，適合霰彈兵伏擊與手榴彈破點。',
    visualClass: 'recon-slide-alley',
  },
  {
    title: 'CAM-04 // SECURITY CHECKPOINT & TERMINAL',
    grid: 'GRID E-01 · PRIMARY GATE',
    desc: '敵軍戰術通訊終端所在地，駭入此處可取得港口防空火控權限。',
    visualClass: 'recon-slide-dock',
  },
];

export class GameScreensManager {
  private preloadContainer: HTMLElement | null = null;
  private preloadFill: HTMLElement | null = null;
  private preloadLabel: HTMLElement | null = null;
  private preloadPct: HTMLElement | null = null;
  private preloadHint: HTMLElement | null = null;
  private reconSlideEl: HTMLElement | null = null;
  private reconTitleEl: HTMLElement | null = null;
  private reconGridEl: HTMLElement | null = null;
  private reconDescEl: HTMLElement | null = null;

  private pauseModal: HTMLElement | null = null;
  private recordsModal: HTMLElement | null = null;
  private titlePortal: HTMLElement | null = null;
  private rewardScreen: HTMLElement | null = null;

  private tipIdx = 0;
  private reconIdx = 0;
  private tipInterval: ReturnType<typeof setInterval> | null = null;
  private reconInterval: ReturnType<typeof setInterval> | null = null;

  // Smooth lerp progress state
  private visualPct = 0;
  private targetPct = 0;
  private lerpRaf: number | null = null;

  constructor() {
    this.createDomElements();
    this.startLerpLoop();
  }

  private createDomElements() {
    if (typeof document === 'undefined') return;

    // 0. Tactical Title Portal (Main Entrance Portal)
    let portalEl = document.getElementById('screen-title-portal');
    if (!portalEl) {
      portalEl = document.createElement('div');
      portalEl.id = 'screen-title-portal';
      portalEl.className = 'screen-portal-overlay';
      portalEl.innerHTML = `
        <div class="portal-backdrop"></div>
        <div class="portal-scanline"></div>
        <div class="portal-container">
          <div class="portal-header-tag">
            <span class="portal-badge-dot"></span>
            <span class="portal-badge-text">TASK FORCE 141 // RECON OPS DIVISION</span>
            <span class="portal-server-status">PACIFIC ASIA-EAST [ONLINE 22ms]</span>
          </div>

          <div class="portal-main-branding">
            <h1 class="portal-title-h1">FIREGUN</h1>
            <div class="portal-hazard-line"></div>
            <div class="portal-subtitle-row">
              <span class="portal-sub-code">ACT-01 // PFT-08</span>
              <span class="portal-sub-name">OPERATION COLD HARBOR (寒港行動)</span>
            </div>
          </div>

          <div class="portal-features-chips">
            <span class="p-chip">⚡ 7-STEP PRELOAD</span>
            <span class="p-chip">🧭 2.2x GYRO AIM</span>
            <span class="p-chip">👥 SQUAD TACTICS</span>
            <span class="p-chip">🧰 3D GUNSMITH</span>
          </div>

          <button id="btn-portal-deploy" class="btn-portal-deploy">
            <span class="btn-portal-glow"></span>
            <span class="btn-portal-text">⚔️ DEPLOY OPERATOR // 點擊進入作戰</span>
          </button>

          <div class="portal-footer-note">PRESS ANY KEY OR TAP SCREEN TO COMMENCE OPERATION</div>
        </div>
      `;
      document.body.appendChild(portalEl);
    }
    this.titlePortal = portalEl;

    // 1. Dynamic Recon Preload Screen (Multi-Angle Surveillance & Lerp Progress Bar)
    let pScreen = document.getElementById('screen-preload');
    if (!pScreen) {
      pScreen = document.createElement('div');
      pScreen.id = 'screen-preload';
      pScreen.className = 'screen-preload-overlay hidden';
      pScreen.innerHTML = `
        <div id="recon-slide-bg" class="preload-recon-bg recon-slide-crane"></div>
        <div class="preload-crt-scanline"></div>
        <div class="preload-recon-hud">
          <div class="recon-hud-top">
            <div class="recon-rec-chip">
              <span class="recon-rec-blip"></span>
              <span id="recon-hud-title" class="recon-title-text">${RECON_SLIDES[0].title}</span>
            </div>
            <div id="recon-hud-grid" class="recon-grid-text">${RECON_SLIDES[0].grid}</div>
          </div>
          <div id="recon-hud-desc" class="recon-desc-text">${RECON_SLIDES[0].desc}</div>
        </div>

        <div class="preload-line-track">
          <div id="preload-line-fill" class="preload-line-fill"></div>
        </div>

        <div class="preload-content-center">
          <div class="preload-badge-title">OPERATION MIDNIGHT RECON // WARMING ENGINE</div>
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
    this.reconSlideEl = document.getElementById('recon-slide-bg');
    this.reconTitleEl = document.getElementById('recon-hud-title');
    this.reconGridEl = document.getElementById('recon-hud-grid');
    this.reconDescEl = document.getElementById('recon-hud-desc');

    // 2. Pause Menu
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

    // 3. Records Modal
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

    // 4. Mission Reward Screen (AAR - After-Action Report & Rank Ceremony)
    let rewardEl = document.getElementById('screen-mission-reward');
    if (!rewardEl) {
      rewardEl = document.createElement('div');
      rewardEl.id = 'screen-mission-reward';
      rewardEl.className = 'screen-reward-overlay hidden';
      rewardEl.innerHTML = `
        <div class="reward-backdrop"></div>
        <div class="reward-card">
          <div class="reward-header">
            <span class="reward-banner-tag">OPERATION DEBRIEF // 作戰授勳結算</span>
            <h2 class="reward-title-h2">MISSION ACCOMPLISHED</h2>
          </div>

          <div class="reward-rank-row">
            <div class="rank-stamp-box">
              <span class="rank-label">COMBAT RATING</span>
              <div id="reward-rank-badge" class="rank-stamp rank-stamp-s">S</div>
            </div>
            <div class="rank-stats-summary">
              <div class="r-stat-line"><span>通關耗時:</span> <b id="r-stat-time">02:15</b></div>
              <div class="r-stat-line"><span>殲滅敵軍:</span> <b id="r-stat-kills">8 / 8</b></div>
              <div class="r-stat-line"><span>精準爆頭率:</span> <b id="r-stat-hs">62%</b></div>
              <div class="r-stat-line"><span>隊友狀態:</span> <b id="r-stat-squad" class="text-green">FULL SURVIVAL</b></div>
            </div>
          </div>

          <div class="reward-exp-card">
            <div class="exp-title-row">
              <span class="exp-wep-name" id="reward-wep-name">AR-7 CARBINE 熟練度</span>
              <span class="exp-lvl-badge" id="reward-lvl-text">LV. 3</span>
            </div>
            <div class="exp-track">
              <div id="reward-exp-bar" class="exp-fill-bar" style="width: 45%;"></div>
            </div>
            <div class="exp-gain-text" id="reward-exp-gain">+850 EXP (RANK BONUS x2.0)</div>
          </div>

          <div id="reward-unlock-alert" class="reward-unlock-box hidden">
            <span class="unlock-icon">🎖️</span>
            <div class="unlock-info">
              <b class="unlock-title">NEW ATTACHMENT UNLOCKED!</b>
              <span class="unlock-name" id="reward-unlock-name">戰術前握把 (VERTICAL GRIP)</span>
            </div>
          </div>

          <div class="reward-credits-row">
            <span>獲得作戰功勳點數:</span>
            <b id="reward-credits-val" class="credits-gold">+1,200 CR</b>
          </div>

          <div class="reward-actions">
            <button id="btn-reward-redeploy" class="btn-reward-primary">⚔️ 再次出擊 (REDEPLOY)</button>
            <button id="btn-reward-gunsmith" class="btn-reward-sec">🧰 槍匠改裝 (GUNSMITH)</button>
            <button id="btn-reward-main" class="btn-reward-sub">🏠 返回主選單</button>
          </div>
        </div>
      `;
      document.body.appendChild(rewardEl);
    }
    this.rewardScreen = rewardEl;

    this.startReconRotation();
  }

  private startLerpLoop() {
    const updateLerp = () => {
      if (this.visualPct < this.targetPct) {
        this.visualPct += (this.targetPct - this.visualPct) * 0.12;
        if (Math.abs(this.visualPct - this.targetPct) < 0.2) {
          this.visualPct = this.targetPct;
        }
        if (this.preloadFill) {
          this.preloadFill.style.width = `${Math.min(100, Math.max(0, this.visualPct))}%`;
        }
        if (this.preloadPct) {
          this.preloadPct.textContent = `${Math.round(this.visualPct)}%`;
        }
      }
      this.lerpRaf = requestAnimationFrame(updateLerp);
    };
    this.lerpRaf = requestAnimationFrame(updateLerp);
  }

  private startReconRotation() {
    if (this.reconInterval) clearInterval(this.reconInterval);
    this.reconInterval = setInterval(() => {
      this.reconIdx = (this.reconIdx + 1) % RECON_SLIDES.length;
      const slide = RECON_SLIDES[this.reconIdx];
      if (this.reconSlideEl) {
        this.reconSlideEl.className = `preload-recon-bg ${slide.visualClass}`;
      }
      if (this.reconTitleEl) this.reconTitleEl.textContent = slide.title;
      if (this.reconGridEl) this.reconGridEl.textContent = slide.grid;
      if (this.reconDescEl) this.reconDescEl.textContent = slide.desc;

      this.tipIdx = (this.tipIdx + 1) % TACTICAL_TIPS.length;
      if (this.preloadHint) {
        this.preloadHint.textContent = TACTICAL_TIPS[this.tipIdx];
      }
    }, 2400);
  }

  public showPortal(onDeploy: () => void) {
    if (!this.titlePortal) return;
    this.titlePortal.classList.remove('hidden');
    const startDeploy = () => {
      this.triggerWhiteFlash(() => {
        this.titlePortal?.classList.add('hidden');
        onDeploy();
      });
    };
    document.getElementById('btn-portal-deploy')?.addEventListener('click', startDeploy, { once: true });
    const keyStart = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        window.removeEventListener('keydown', keyStart);
        startDeploy();
      }
    };
    window.addEventListener('keydown', keyStart);
  }

  public hidePortal() {
    this.titlePortal?.classList.add('hidden');
  }

  public showTitleScreen(onDeploy: () => void) {
    this.showPortal(onDeploy);
  }

  public showPreload() {
    if (this.preloadContainer) {
      this.preloadContainer.style.opacity = '1';
      this.preloadContainer.classList.remove('hidden');
    }
  }

  public updatePreload(status: PreloadStatus) {
    this.targetPct = Math.min(100, Math.max(0, status.percent));
    if (this.preloadLabel) {
      this.preloadLabel.textContent = `STEP ${status.step}/${status.totalSteps} · ${status.label}`;
    }
    if (this.preloadHint && status.hint) {
      this.preloadHint.textContent = status.hint;
    }
  }

  public hidePreload() {
    if (this.reconInterval) {
      clearInterval(this.reconInterval);
      this.reconInterval = null;
    }
    if (this.preloadContainer) {
      this.preloadContainer.style.opacity = '0';
      setTimeout(() => this.preloadContainer?.classList.add('hidden'), 450);
    }
  }

  public showRewardScreen(
    stats: MatchStats,
    callbacks: { onRedeploy: () => void; onGunsmith: () => void; onMainMenu: () => void }
  ) {
    if (!this.rewardScreen) return;
    const prog = loadProgression();
    const currentWepExp = prog.weapons['ar7']?.exp || 450;
    const result = computeMatchRewards(stats, currentWepExp, 500);

    // Save updated progression
    prog.stats.totalKills += stats.totalKills;
    prog.stats.totalHeadshots += stats.headshots;
    prog.credits += result.tacticalCreditsEarned;
    if (prog.weapons['ar7']) {
      prog.weapons['ar7'].exp += result.weaponExpGained;
      prog.weapons['ar7'].level = result.newLevel;
    }
    saveProgression(prog);

    // Populate DOM
    const rankBadge = document.getElementById('reward-rank-badge');
    if (rankBadge) {
      rankBadge.textContent = result.rank;
      rankBadge.className = `rank-stamp rank-stamp-${result.rank.toLowerCase()}`;
    }
    const mins = Math.floor(stats.clearTimeSec / 60);
    const secs = String(stats.clearTimeSec % 60).padStart(2, '0');
    const timeEl = document.getElementById('r-stat-time');
    if (timeEl) timeEl.textContent = `${mins}:${secs}`;
    const killsEl = document.getElementById('r-stat-kills');
    if (killsEl) killsEl.textContent = `${stats.totalKills} / 8`;
    const hsEl = document.getElementById('r-stat-hs');
    const hsPct = stats.totalKills > 0 ? Math.round((stats.headshots / stats.totalKills) * 100) : 0;
    if (hsEl) hsEl.textContent = `${hsPct}%`;
    const sqEl = document.getElementById('r-stat-squad');
    if (sqEl) {
      sqEl.textContent = stats.alliesAlive === 2 ? 'FULL SQUAD (2/2)' : `${stats.alliesAlive} ALIVE`;
      sqEl.className = stats.alliesAlive === 2 ? 'text-green' : 'text-gold';
    }

    const lvlEl = document.getElementById('reward-lvl-text');
    if (lvlEl) lvlEl.textContent = `LV. ${result.newLevel}`;
    const expGainEl = document.getElementById('reward-exp-gain');
    if (expGainEl) expGainEl.textContent = `+${result.weaponExpGained} EXP (RANK ${result.rank} BONUS)`;
    const expBar = document.getElementById('reward-exp-bar');
    if (expBar) {
      const expInLevel = (currentWepExp + result.weaponExpGained) % 500;
      const fillPct = Math.min(100, Math.round((expInLevel / 500) * 100));
      expBar.style.width = '0%';
      setTimeout(() => {
        expBar.style.width = `${fillPct}%`;
      }, 250);
    }

    const unlockBox = document.getElementById('reward-unlock-alert');
    const unlockName = document.getElementById('reward-unlock-name');
    if (result.unlockedAttachmentId && unlockBox && unlockName) {
      unlockName.textContent = result.unlockedAttachmentId.toUpperCase().replace('_', ' ');
      unlockBox.classList.remove('hidden');
    } else if (unlockBox) {
      unlockBox.classList.add('hidden');
    }

    const credEl = document.getElementById('reward-credits-val');
    if (credEl) credEl.textContent = `+${result.tacticalCreditsEarned} CR`;

    // Bind action buttons
    document.getElementById('btn-reward-redeploy')?.addEventListener(
      'click',
      () => {
        this.rewardScreen?.classList.add('hidden');
        callbacks.onRedeploy();
      },
      { once: true }
    );
    document.getElementById('btn-reward-gunsmith')?.addEventListener(
      'click',
      () => {
        this.rewardScreen?.classList.add('hidden');
        callbacks.onGunsmith();
      },
      { once: true }
    );
    document.getElementById('btn-reward-main')?.addEventListener(
      'click',
      () => {
        this.rewardScreen?.classList.add('hidden');
        callbacks.onMainMenu();
      },
      { once: true }
    );

    this.rewardScreen.classList.remove('hidden');
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
