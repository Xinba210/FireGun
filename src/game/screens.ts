import { loadProgression, saveProgression } from './progression.ts';
import { calculateOperationRank, computeMatchRewards, type MatchStats, type MatchRewardResult } from './rewards.ts';
import { tacticalRadioAudio } from './audio.ts';

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
    imageUrl: 'assets/slides/slide_crane.jpg',
  },
  {
    title: 'CAM-02 // CARGO VESSEL ANTONOV QUAYSIDE',
    grid: 'GRID D-08 · MOORING PIER',
    desc: '萬噸貨輪泊位與潮濕舷梯通道，巡邏隊每 45 秒往返碼頭檢查哨。',
    visualClass: 'recon-slide-ship',
    imageUrl: 'assets/slides/slide_ship.jpg',
  },
  {
    title: 'CAM-03 // UNDERGROUND CATWALK & CONTAINER ALLEY',
    grid: 'GRID W-12 · INNER YARD',
    desc: '集裝箱迷宮與高架鋼構貓道，適合霰彈兵伏擊與手榴彈破點。',
    visualClass: 'recon-slide-alley',
    imageUrl: 'assets/slides/slide_alley.jpg',
  },
  {
    title: 'CAM-04 // SECURITY CHECKPOINT & TERMINAL',
    grid: 'GRID E-01 · PRIMARY GATE',
    desc: '敵軍戰術通訊終端所在地，駭入此處可取得港口防空火控權限。',
    visualClass: 'recon-slide-dock',
    imageUrl: 'assets/slides/slide_dock.jpg',
  },
  {
    title: 'CAM-05 // OVERHEAD CATWALK & RL-7 ARSENAL',
    grid: 'GRID B-04 · ELEVATION 14m',
    desc: '高架巡邏走道與重火器物資箱，可俯瞰整個西側貨櫃轉運區。',
    visualClass: 'recon-slide-catwalk',
    imageUrl: 'assets/slides/slide_catwalk.jpg',
  },
  {
    title: 'CAM-06 // JUGGERNAUT HEAVY DEFENSE ZONE',
    grid: 'GRID H-09 · STORAGE SILO',
    desc: '重裝甲機槍首領駐守防區，需保持距離並尋求隊友火力壓制。',
    visualClass: 'recon-slide-boss',
    imageUrl: 'assets/slides/slide_boss.jpg',
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

  // Dedicated lifecycle and deploy triggers
  private onDeployCallback: (() => void) | null = null;
  private onGunsmithCallback: (() => void) | null = null;
  private portalDeployPending = false;
  private isDeploying = false;

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
      portalEl.className = 'screen-portal-overlay hidden';
      portalEl.innerHTML = `
        <div class="portal-backdrop"></div>
        <div class="portal-scanline"></div>
        <div class="portal-container">
          <div class="portal-header-tag">
            <span class="portal-badge-dot"></span>
            <span class="portal-badge-text">TASK FORCE 141 // RECON OPS DIVISION</span>
            <span class="portal-version-badge">v1.6.1</span>
            <span class="portal-server-status">PACIFIC ASIA-EAST [ONLINE 22ms]</span>
          </div>

          <div class="portal-main-branding">
            <h1 class="portal-title-h1">FIREGUN <span class="portal-version-inline">v1.6.1</span></h1>
            <div class="portal-hazard-line"></div>
            <div class="portal-subtitle-row">
              <span class="portal-sub-code">ACT-01 // PFT-08</span>
              <span class="portal-sub-name">OPERATION COLD HARBOR (寒港行動)</span>
              <span class="portal-sub-ver">BUILD 1.6.1</span>
            </div>
          </div>

          <!-- Tactical Navigation Glass Bar -->
          <div class="portal-nav-bar">
            <button id="btn-portal-tab-campaign" class="btn-portal-tab active">⚔️ 戰役行動 (CAMPAIGN)</button>
            <button id="btn-portal-tab-gunsmith" class="btn-portal-tab">🧰 戰術軍械庫 (GUNSMITH)</button>
            <button id="btn-portal-tab-dossier" class="btn-portal-tab">📊 作戰紀錄 (DOSSIER)</button>
          </div>

          <div class="portal-features-chips">
            <span class="p-chip">🚁 HELI INFILTRATION</span>
            <span class="p-chip">📻 RADIO NARRATIVE</span>
            <span class="p-chip">🧭 2.2x GYRO AIM</span>
            <span class="p-chip">👥 SQUAD TACTICS</span>
          </div>

          <button id="btn-portal-deploy" class="btn-portal-deploy">
            <span class="btn-portal-glow"></span>
            <span class="btn-portal-text">⚔️ DEPLOY OPERATOR // 點擊進入作戰</span>
          </button>

          <div class="portal-footer-note">PRESS ANY KEY OR TAP SCREEN TO COMMENCE OPERATION · CLIENT v1.6.1</div>
        </div>
      `;
      document.body.appendChild(portalEl);

      // In-game dynamic radio transmission HUD
      let radioChatter = document.getElementById('ingame-radio-chatter');
      if (!radioChatter) {
        radioChatter = document.createElement('div');
        radioChatter.id = 'ingame-radio-chatter';
        radioChatter.className = 'ingame-radio-overlay hidden';
        radioChatter.innerHTML = `
          <div class="radio-card">
            <div class="radio-card-header">
              <div class="radio-speaker-badge">
                <span class="radio-live-blip"></span>
                <span id="radio-card-speaker" class="radio-speaker-callsign">[COMMAND]</span>
              </div>
              <div class="radio-freq-waveform">
                <span></span><span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
            <div class="radio-card-body" id="radio-card-text">
              "SAT-RECON confirms enemy presence. Keep it quiet."
            </div>
          </div>
        `;
        document.body.appendChild(radioChatter);
      }
    }
    this.titlePortal = portalEl;

    // Attach early eager fallback listeners so even pre-warmed clicks/touches register safely
    const earlyDeployBtn = portalEl.querySelector('#btn-portal-deploy') as HTMLElement | null;
    const earlyCampBtn = portalEl.querySelector('#btn-portal-tab-campaign') as HTMLElement | null;
    this.bindPortalTap(earlyDeployBtn, (e) => this.triggerDeployAction(e));
    this.bindPortalTap(earlyCampBtn, (e) => this.triggerDeployAction(e));
    this.bindPortalTap(portalEl, (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.btn-portal-tab') || target.closest('.btn-portal-deploy') || target.closest('.portal-nav-bar')) {
        return;
      }
      this.triggerDeployAction(e);
    });

    // 1. Dynamic Recon Preload Screen (Multi-Angle Surveillance & Lerp Progress Bar)
    let pScreen = document.getElementById('screen-preload');
    if (!pScreen) {
      pScreen = document.createElement('div');
      pScreen.id = 'screen-preload';
      pScreen.className = 'screen-preload-overlay hidden';
      pScreen.innerHTML = `
        <div id="recon-slide-bg" class="preload-recon-bg ${RECON_SLIDES[0].visualClass}" style="background-image: url('${RECON_SLIDES[0].imageUrl}');"></div>
        <div class="preload-cinematic-vignette"></div>
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

        <div class="preload-content-center">
          <div class="preload-badge-row">
            <span class="preload-badge-title">OPERATION MIDNIGHT RECON // WARMING ENGINE</span>
            <span class="preload-version-pill">BUILD v1.6.1</span>
          </div>
          <div class="preload-stage-row">
            <span id="preload-stage-label" class="preload-stage-label">[v1.6.1] STEP 1/7 · DOWNLOADING ASSETS...</span>
            <span id="preload-stage-pct" class="preload-stage-pct">0%</span>
          </div>
          <div class="preload-line-track">
            <div id="preload-line-fill" class="preload-line-fill"></div>
          </div>
          <div id="preload-stage-hint" class="preload-stage-hint">${TACTICAL_TIPS[0]}</div>
          <div class="preload-footer-ver">FIREGUN TACTICAL ENGINE · CLIENT v1.6.1-REL</div>
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
            <span class="pause-code">GRID K2 · PACIFIC TIME 02:40 · BUILD v1.6.1</span>
          </div>
          <div class="pause-actions">
            <button id="btn-pause-resume" class="btn-pause-act btn-pause-primary">RESUME OPERATION // 繼續作戰</button>
            <button id="btn-pause-gunsmith" class="btn-pause-act">🧰 戰術軍械庫 (GUNSMITH WORKBENCH)</button>
            <button id="btn-pause-hud-editor" class="btn-pause-act">⚙️ 鍵位自訂與體感 (CUSTOM TOUCH & GYRO)</button>
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
        this.reconSlideEl.style.backgroundImage = `url("${slide.imageUrl}")`;
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

  private radioTimeout: ReturnType<typeof setTimeout> | null = null;

  public showInGameRadio(speaker: string, text: string, durationSec = 4.0): void {
    const el = document.getElementById('ingame-radio-chatter');
    const spk = document.getElementById('radio-card-speaker');
    const txt = document.getElementById('radio-card-text');
    if (!el || !spk || !txt) return;
    spk.textContent = speaker;
    txt.textContent = text;
    el.classList.remove('hidden');
    if (this.radioTimeout) clearTimeout(this.radioTimeout);
    this.radioTimeout = setTimeout(() => {
      el.classList.add('hidden');
    }, durationSec * 1000);
  }

  private bindPortalTap(el: HTMLElement | null, handler: (e: Event) => void) {
    if (!el) return;
    el.onclick = (e) => handler(e);
    el.ontouchend = (e) => handler(e);
    el.addEventListener('pointerup', (e) => {
      // Fire on touch or primary mouse button
      if (e.pointerType === 'touch' || e.button === 0) {
        handler(e);
      }
    });
  }

  public triggerDeployAction(e?: Event) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (this.isDeploying) return;

    // Unlock Web Audio immediately on first user touch / click
    tacticalRadioAudio.initAudio().catch(() => {});

    if (this.onDeployCallback) {
      this.isDeploying = true;
      this.titlePortal?.classList.add('hidden');
      this.triggerWhiteFlash();
      this.onDeployCallback();
    } else {
      // User tapped while engine is still warming up
      this.portalDeployPending = true;
      const btnText = this.titlePortal?.querySelector('.btn-portal-text');
      if (btnText) {
        btnText.textContent = '⏳ INFILTRATION READY // 準備著陸中...';
      }
    }
  }

  public showPortal(onDeploy: () => void, onGunsmith?: () => void) {
    this.onDeployCallback = onDeploy;
    if (onGunsmith) this.onGunsmithCallback = onGunsmith;

    if (this.portalDeployPending) {
      this.portalDeployPending = false;
      this.triggerDeployAction();
      return;
    }

    if (!this.titlePortal) return;
    this.titlePortal.classList.remove('hidden');

    const deployBtn = document.getElementById('btn-portal-deploy');
    const campBtn = document.getElementById('btn-portal-tab-campaign');
    const gunsmithBtn = document.getElementById('btn-portal-tab-gunsmith');
    const dossierBtn = document.getElementById('btn-portal-tab-dossier');

    this.bindPortalTap(deployBtn, (e) => this.triggerDeployAction(e));
    this.bindPortalTap(campBtn, (e) => this.triggerDeployAction(e));

    this.bindPortalTap(gunsmithBtn, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.titlePortal?.classList.add('hidden');
      (this.onGunsmithCallback || onGunsmith)?.();
    });

    this.bindPortalTap(dossierBtn, (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.titlePortal?.classList.add('hidden');
      this.showRecords(() => {
        // Return to title portal if closed before game deployment
        if (!this.isDeploying) {
          this.titlePortal?.classList.remove('hidden');
        }
      });
    });

    // Tap anywhere on the portal backdrop/screen to deploy as stated in footer note
    this.bindPortalTap(this.titlePortal, (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.btn-portal-tab') || target.closest('.btn-portal-deploy') || target.closest('.portal-nav-bar')) {
        return;
      }
      this.triggerDeployAction(e);
    });

    const keyStart = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        window.removeEventListener('keydown', keyStart);
        this.triggerDeployAction(e);
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
      this.preloadLabel.textContent = `[v1.6.1] STEP ${status.step}/${status.totalSteps} · ${status.label}`;
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

  public showRecords(onClose?: () => void) {
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

    const backBtn = document.getElementById('btn-records-back');
    if (backBtn) {
      const handleClose = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.recordsModal?.classList.add('hidden');
        onClose?.();
      };
      backBtn.onclick = handleClose;
      backBtn.ontouchend = handleClose;
    }
  }

  public hideRecords() {
    this.recordsModal?.classList.add('hidden');
  }

  // ---------------------------------------------------------------------------
  // Goal C: Mobile Pro Touch HUD Editor & Advanced Gyro Tuning
  // ---------------------------------------------------------------------------
  public showHudEditor(options: {
    gyroConfig: { yawSens: number; pitchSens: number; deadzone: number; invertPitch: boolean; aimAssist: boolean };
    onSave: (layout: Record<string, { leftPct: number; topPct: number; scale: number; opacity: number }>, gyro: typeof options.gyroConfig) => void;
    onReset: () => void;
  }) {
    const editor = document.getElementById('screen-hud-editor');
    if (!editor) return;
    editor.classList.remove('hidden');

    const viewport = document.getElementById('hud-editor-viewport');
    if (!viewport) return;

    // Load saved layout or defaults
    const savedLayoutStr = typeof localStorage !== 'undefined' ? localStorage.getItem('firegun_hud_layout_v1') : null;
    let layout: Record<string, { label: string; leftPct: number; topPct: number; scale: number; opacity: number }> = {
      'touch-joystick-zone': { label: 'JOYSTICK', leftPct: 18, topPct: 80, scale: 1.0, opacity: 0.85 },
      'touch-btn-fire': { label: 'FIRE', leftPct: 84, topPct: 82, scale: 1.1, opacity: 0.9 },
      'touch-btn-ads': { label: 'ADS 瞄準', leftPct: 64, topPct: 78, scale: 1.0, opacity: 0.85 },
      'touch-btn-reload': { label: 'RELOAD', leftPct: 62, topPct: 92, scale: 1.0, opacity: 0.85 },
      'touch-btn-jump': { label: 'JUMP', leftPct: 88, topPct: 64, scale: 1.0, opacity: 0.85 },
      'touch-btn-crouch': { label: 'CROUCH', leftPct: 86, topPct: 94, scale: 1.0, opacity: 0.85 },
      'touch-btn-swap': { label: 'SWAP', leftPct: 74, topPct: 68, scale: 1.0, opacity: 0.85 },
      'touch-btn-grenade': { label: 'GRENADE', leftPct: 54, topPct: 68, scale: 1.0, opacity: 0.85 },
      'touch-btn-gyro-recenter': { label: 'RECENTER', leftPct: 94, topPct: 36, scale: 1.0, opacity: 0.85 },
    };

    if (savedLayoutStr) {
      try {
        const parsed = JSON.parse(savedLayoutStr);
        for (const k in parsed) {
          if (layout[k]) {
            layout[k].leftPct = parsed[k].leftPct;
            layout[k].topPct = parsed[k].topPct;
            layout[k].scale = parsed[k].scale;
            layout[k].opacity = parsed[k].opacity;
          }
        }
      } catch {
        // ignore
      }
    }

    let activeKey = 'touch-btn-fire';

    // Render viewport draggable nodes
    const renderNodes = () => {
      viewport.innerHTML = '<div class="editor-safe-area-guide">SAFE DRAG AREA</div>';
      for (const [key, item] of Object.entries(layout)) {
        const node = document.createElement('div');
        node.className = `hud-editor-node ${key === activeKey ? 'selected' : ''}`;
        node.id = `edit-node-${key}`;
        node.textContent = item.label;
        node.style.left = `${item.leftPct}%`;
        node.style.top = `${item.topPct}%`;
        const sizePx = Math.round(54 * item.scale);
        node.style.width = `${sizePx}px`;
        node.style.height = `${sizePx}px`;
        node.style.opacity = `${item.opacity}`;

        // Pointer drag event
        let isDragging = false;
        node.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          activeKey = key;
          isDragging = true;
          renderNodes();
          syncInspector();
        });

        node.addEventListener('pointermove', (e) => {
          if (!isDragging) return;
          const rect = viewport.getBoundingClientRect();
          const x = Math.max(8, Math.min(rect.width - 8, e.clientX - rect.left));
          const y = Math.max(8, Math.min(rect.height - 8, e.clientY - rect.top));
          item.leftPct = Number(((x / rect.width) * 100).toFixed(1));
          item.topPct = Number(((y / rect.height) * 100).toFixed(1));
          node.style.left = `${item.leftPct}%`;
          node.style.top = `${item.topPct}%`;
        });

        const stopDrag = (e: PointerEvent) => {
          if (isDragging) {
            isDragging = false;
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              // ignore
            }
          }
        };
        node.addEventListener('pointerup', stopDrag);
        node.addEventListener('pointercancel', stopDrag);

        viewport.appendChild(node);
      }
    };

    const syncInspector = () => {
      const item = layout[activeKey];
      if (!item) return;
      const nameEl = document.getElementById('editor-selected-name');
      const scaleSlider = document.getElementById('slider-elem-scale') as HTMLInputElement | null;
      const scaleVal = document.getElementById('val-elem-scale');
      const opacitySlider = document.getElementById('slider-elem-opacity') as HTMLInputElement | null;
      const opacityVal = document.getElementById('val-elem-opacity');

      if (nameEl) nameEl.textContent = `${item.label} (${activeKey.replace('touch-btn-', '').toUpperCase()})`;
      if (scaleSlider) scaleSlider.value = String(Math.round(item.scale * 100));
      if (scaleVal) scaleVal.textContent = `${Math.round(item.scale * 100)}%`;
      if (opacitySlider) opacitySlider.value = String(Math.round(item.opacity * 100));
      if (opacityVal) opacityVal.textContent = `${Math.round(item.opacity * 100)}%`;
    };

    renderNodes();
    syncInspector();

    // Inspector sliders
    document.getElementById('slider-elem-scale')?.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      if (layout[activeKey]) {
        layout[activeKey].scale = val / 100;
        const vEl = document.getElementById('val-elem-scale');
        if (vEl) vEl.textContent = `${val}%`;
        const node = document.getElementById(`edit-node-${activeKey}`);
        if (node) {
          const sizePx = Math.round(54 * (val / 100));
          node.style.width = `${sizePx}px`;
          node.style.height = `${sizePx}px`;
        }
      }
    });

    document.getElementById('slider-elem-opacity')?.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      if (layout[activeKey]) {
        layout[activeKey].opacity = val / 100;
        const vEl = document.getElementById('val-elem-opacity');
        if (vEl) vEl.textContent = `${val}%`;
        const node = document.getElementById(`edit-node-${activeKey}`);
        if (node) node.style.opacity = `${val / 100}`;
      }
    });

    // Preset Buttons
    document.getElementById('preset-2finger')?.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
      document.getElementById('preset-2finger')?.classList.add('active');
      layout['touch-joystick-zone'] = { label: 'JOYSTICK', leftPct: 18, topPct: 80, scale: 1.0, opacity: 0.85 };
      layout['touch-btn-fire'] = { label: 'FIRE', leftPct: 84, topPct: 82, scale: 1.1, opacity: 0.9 };
      layout['touch-btn-ads'] = { label: 'ADS 瞄準', leftPct: 64, topPct: 78, scale: 1.0, opacity: 0.85 };
      layout['touch-btn-reload'] = { label: 'RELOAD', leftPct: 62, topPct: 92, scale: 1.0, opacity: 0.85 };
      layout['touch-btn-jump'] = { label: 'JUMP', leftPct: 88, topPct: 64, scale: 1.0, opacity: 0.85 };
      layout['touch-btn-crouch'] = { label: 'CROUCH', leftPct: 86, topPct: 94, scale: 1.0, opacity: 0.85 };
      renderNodes();
      syncInspector();
    });

    document.getElementById('preset-3finger')?.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
      document.getElementById('preset-3finger')?.classList.add('active');
      layout['touch-joystick-zone'] = { label: 'JOYSTICK', leftPct: 18, topPct: 80, scale: 1.0, opacity: 0.85 };
      layout['touch-btn-fire'] = { label: 'FIRE', leftPct: 14, topPct: 24, scale: 1.25, opacity: 0.95 }; // Left Top Fire
      layout['touch-btn-ads'] = { label: 'ADS 瞄準', leftPct: 82, topPct: 78, scale: 1.0, opacity: 0.85 };
      layout['touch-btn-reload'] = { label: 'RELOAD', leftPct: 62, topPct: 88, scale: 1.0, opacity: 0.85 };
      renderNodes();
      syncInspector();
    });

    document.getElementById('preset-4finger')?.addEventListener('click', () => {
      document.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
      document.getElementById('preset-4finger')?.classList.add('active');
      layout['touch-btn-fire'] = { label: 'FIRE', leftPct: 12, topPct: 18, scale: 1.2, opacity: 0.95 }; // Top-left
      layout['touch-btn-ads'] = { label: 'ADS 瞄準', leftPct: 86, topPct: 18, scale: 1.1, opacity: 0.95 }; // Top-right
      layout['touch-joystick-zone'] = { label: 'JOYSTICK', leftPct: 18, topPct: 80, scale: 1.0, opacity: 0.85 };
      layout['touch-btn-reload'] = { label: 'RELOAD', leftPct: 60, topPct: 86, scale: 1.0, opacity: 0.85 };
      renderNodes();
      syncInspector();
    });

    // Gyro tuning controls
    const gyroYaw = document.getElementById('slider-gyro-yaw') as HTMLInputElement | null;
    const gyroPitch = document.getElementById('slider-gyro-pitch') as HTMLInputElement | null;
    const gyroDead = document.getElementById('slider-gyro-deadzone') as HTMLInputElement | null;
    const gyroInvert = document.getElementById('check-gyro-invert') as HTMLInputElement | null;
    const gyroAssist = document.getElementById('check-gyro-assist') as HTMLInputElement | null;

    if (gyroYaw) gyroYaw.value = String(Math.round(options.gyroConfig.yawSens * 10));
    if (gyroPitch) gyroPitch.value = String(Math.round(options.gyroConfig.pitchSens * 10));
    if (gyroDead) gyroDead.value = String(Math.round(options.gyroConfig.deadzone * 100));
    if (gyroInvert) gyroInvert.checked = options.gyroConfig.invertPitch;
    if (gyroAssist) gyroAssist.checked = options.gyroConfig.aimAssist;

    gyroYaw?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 10;
      options.gyroConfig.yawSens = v;
      const el = document.getElementById('val-gyro-yaw');
      if (el) el.textContent = `${v.toFixed(1)}x`;
    });

    gyroPitch?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 10;
      options.gyroConfig.pitchSens = v;
      const el = document.getElementById('val-gyro-pitch');
      if (el) el.textContent = `${v.toFixed(1)}x`;
    });

    gyroDead?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value) / 100;
      options.gyroConfig.deadzone = v;
      const el = document.getElementById('val-gyro-deadzone');
      if (el) el.textContent = `${v.toFixed(2)}`;
    });

    gyroInvert?.addEventListener('change', (e) => {
      options.gyroConfig.invertPitch = (e.target as HTMLInputElement).checked;
    });

    gyroAssist?.addEventListener('change', (e) => {
      options.gyroConfig.aimAssist = (e.target as HTMLInputElement).checked;
    });

    // Tab switching in bottom bar
    document.getElementById('tab-edit-element')?.addEventListener('click', () => {
      document.getElementById('tab-edit-element')?.classList.add('active');
      document.getElementById('tab-edit-gyro')?.classList.remove('active');
      document.getElementById('panel-edit-element')?.classList.remove('hidden');
      document.getElementById('panel-edit-gyro')?.classList.add('hidden');
    });

    document.getElementById('tab-edit-gyro')?.addEventListener('click', () => {
      document.getElementById('tab-edit-gyro')?.classList.add('active');
      document.getElementById('tab-edit-element')?.classList.remove('active');
      document.getElementById('panel-edit-gyro')?.classList.remove('hidden');
      document.getElementById('panel-edit-element')?.classList.add('hidden');
    });

    // Save and Apply
    document.getElementById('btn-hud-editor-save')?.addEventListener('click', () => {
      const cleanLayout: Record<string, { leftPct: number; topPct: number; scale: number; opacity: number }> = {};
      for (const k in layout) {
        cleanLayout[k] = {
          leftPct: layout[k].leftPct,
          topPct: layout[k].topPct,
          scale: layout[k].scale,
          opacity: layout[k].opacity,
        };
      }
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('firegun_hud_layout_v1', JSON.stringify(cleanLayout));
          localStorage.setItem('firegun_gyro_config_v1', JSON.stringify(options.gyroConfig));
        }
      } catch {
        // ignore
      }
      editor.classList.add('hidden');
      options.onSave(cleanLayout, options.gyroConfig);
    });

    // Reset default
    document.getElementById('btn-hud-editor-reset')?.addEventListener('click', () => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('firegun_hud_layout_v1');
          localStorage.removeItem('firegun_gyro_config_v1');
        }
      } catch {
        // ignore
      }
      editor.classList.add('hidden');
      options.onReset();
    });

    document.getElementById('btn-hud-editor-close')?.addEventListener('click', () => {
      editor.classList.add('hidden');
    });
  }
}

