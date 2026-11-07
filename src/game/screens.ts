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

export interface TacticalSetupOptions {
  credits?: number;
  activeWeaponName?: string;
  activeWeaponLevel?: number;
  activeWeaponDesc?: string;
  activeWeaponStats?: { dmg: number; rof: number; stb: number; rng: number; cap: number };
  currentMode: 'RAID' | 'SURVIVAL' | 'SNIPER' | 'BLITZ';
  currentDifficulty: 'STANDARD' | 'HARDCORE' | 'NIGHTMARE';
  gyroEnabled: boolean;
  gyroSens: number;
  autofireEnabled: boolean;
  hapticsEnabled: boolean;
  onDeploy: () => void;
  onOpenGunsmith: () => void;
  onOpenOperatorShowcase?: () => void;
  onOpenHudEditor: () => void;
  onBackToTitle: () => void;
  onModeChange: (mode: 'RAID' | 'SURVIVAL' | 'SNIPER' | 'BLITZ') => void;
  onDifficultyChange: (diff: 'STANDARD' | 'HARDCORE' | 'NIGHTMARE') => void;
  onGyroToggle: () => void;
  onGyroSensCycle: () => void;
  onAutofireToggle: () => void;
  onHapticsToggle: () => void;
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
  private setupModal: HTMLElement | null = null;
  private setupOptions: TacticalSetupOptions | null = null;
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

    // 0. Tactical Title Portal (Main 3A Hero Entrance Screen)
    let portalEl = document.getElementById('screen-title-portal');
    if (!portalEl) {
      portalEl = document.createElement('div');
      portalEl.id = 'screen-title-portal';
      portalEl.className = 'screen-portal-overlay hidden';
      portalEl.innerHTML = `
        <div class="portal-backdrop">
          <div class="portal-hero-bg"></div>
          <div class="portal-spotlight-beam"></div>
          <div class="portal-rain-layer"></div>
        </div>
        <div class="portal-scanline"></div>
        <div class="portal-container">
          <div class="portal-header-tag">
            <span class="portal-badge-dot"></span>
            <span class="portal-badge-text">TASK FORCE 141 // RECON OPS DIVISION</span>
            <span class="portal-version-badge">v2.0.0</span>
            <span class="portal-server-status">PACIFIC ASIA-EAST [ONLINE 22ms]</span>
          </div>

          <div class="portal-main-branding">
            <h1 class="portal-title-h1">FIREGUN <span class="portal-version-inline">v2.0.0</span></h1>
            <div class="portal-hazard-line"></div>
            <div class="portal-subtitle-row">
              <span class="portal-sub-code">ACT-01 // PFT-08</span>
              <span class="portal-sub-name">OPERATION COLD HARBOR (寒港行動)</span>
              <span class="portal-sub-ver">BUILD 2.0.0-TACTICAL</span>
            </div>
          </div>

          <div class="portal-features-chips">
            <span class="p-chip">STEALTH HELI INFIL</span>
            <span class="p-chip">TACTICAL RADIO</span>
            <span class="p-chip">2.2x GYRO AIM</span>
            <span class="p-chip">ALLIED SQUAD</span>
          </div>

          <div class="portal-cta-group">
            <button id="btn-portal-operator" class="btn-portal-deploy btn-portal-operator-hero">
              <span class="btn-portal-glow"></span>
              <span class="btn-portal-text">特戰幹員與裝備 // SELECT OPERATOR & LOADOUT</span>
            </button>
            <button id="btn-portal-deploy" class="btn-portal-deploy btn-portal-start-hero">
              <span class="btn-portal-glow"></span>
              <span class="btn-portal-text">快速進入戰役 // QUICK DEPLOY</span>
            </button>
          </div>

          <div class="portal-footer-note">PRESS ENTER OR TAP ANYWHERE TO START · CLIENT v2.0.0-TACTICAL</div>
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
    this.bindPortalTap(earlyDeployBtn, (e) => this.triggerDeployAction(e));
    this.bindPortalTap(portalEl, (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.btn-portal-deploy')) {
        return;
      }
      this.triggerDeployAction(e);
    });

    // 0.5 Tactical Setup Hub (Briefing & Operation Settings Screen)
    let setupEl = document.getElementById('screen-tactical-setup');
    if (!setupEl) {
      setupEl = document.createElement('div');
      setupEl.id = 'screen-tactical-setup';
      setupEl.className = 'screen-setup-overlay hidden';
      setupEl.innerHTML = `
        <div class="setup-backdrop">
          <div class="setup-hero-bg"></div>
          <div class="setup-ambient-vignette"></div>
        </div>
        <div class="setup-scanlines"></div>
        <div class="setup-container">
          <div class="setup-header">
            <div class="setup-header-left">
              <div class="setup-badge-row">
                <span class="setup-badge-dot"></span>
                <span class="setup-badge-text">TASK FORCE 141 // OPERATION COLD HARBOR</span>
                <span class="setup-ver-pill">v2.0.0</span>
              </div>
              <h2 class="setup-title-h2">戰役作戰整備室 <span class="setup-title-sub">// TACTICAL SETUP</span></h2>
            </div>
            <div class="setup-header-right">
              <span class="setup-chip-server">PACIFIC ASIA-EAST [22ms]</span>
              <span class="setup-chip-credits">CREDITS: <b id="setup-credits-val" class="text-gold">1,250 CR</b></span>
            </div>
          </div>

          <!-- 4 Nav Tabs (Default on OPERATOR for direct character showcase) -->
          <div class="setup-nav-tabs">
            <button id="setup-tab-btn-operator" class="setup-tab-nav active">裝備與角色 (OPERATOR)</button>
            <button id="setup-tab-btn-briefing" class="setup-tab-nav">作戰情報 (MODES)</button>
            <button id="setup-tab-btn-gunsmith" class="setup-tab-nav">武器軍械庫 (GUNSMITH)</button>
            <button id="setup-tab-btn-settings" class="setup-tab-nav">體感操作 (SETTINGS)</button>
          </div>

          <!-- Panel 1: Operator Showcase 3D Workshop (Default Active) -->
          <div id="setup-panel-operator" class="setup-panel-content active">
            <div class="operator-showcase-layout">
              <div class="showcase-3d-viewport">
                <div id="showcase-mount-point" class="showcase-mount-point"></div>
                <div class="showcase-drag-hint">滑鼠拖曳 / 單指滑動 360° 旋轉檢視特戰隊員</div>
                
                <!-- 3D 導覽相機特寫按鈕 -->
                <div class="showcase-tour-controls">
                  <button data-tour="full" class="btn-tour-pill active">全景 (FULL)</button>
                  <button data-tour="helmet" class="btn-tour-pill">頭盔 (HELMET)</button>
                  <button data-tour="chest" class="btn-tour-pill">背心 (VEST)</button>
                  <button data-tour="waist" class="btn-tour-pill">腰際 (WAIST)</button>
                  <button data-tour="legs" class="btn-tour-pill">槍套 (LEGS)</button>
                </div>
              </div>
              <div class="showcase-controls-panel">
                <div class="showcase-sec-title">SELECT OPERATOR // 特戰幹員選擇</div>
                <div class="showcase-operator-pills">
                  <button data-operator="ROACH" class="btn-operator-pill active">鬼影 ROACH (暗潮特遣隊)</button>
                  <button data-operator="MAVERICK" class="btn-operator-pill">遊俠 MAVERICK (TopGun特種空勤)</button>
                </div>

                <div class="showcase-sec-title">TACTICAL LOADOUT // 戰術裝備套組</div>
                <div class="showcase-loadout-pills">
                  <button data-loadout="ASSAULT" class="btn-loadout-pill active">突擊先鋒 (ASSAULT)</button>
                  <button data-loadout="RECON" class="btn-loadout-pill">輕裝特偵 (RECON)</button>
                  <button data-loadout="BREACHER" class="btn-loadout-pill">重裝破障 (BREACHER)</button>
                  <button data-loadout="SNIPER" class="btn-loadout-pill">暗夜狙擊 (SNIPER)</button>
                </div>

                <div class="showcase-sec-title">TACTICAL GRENADE // 戰術投擲裝備</div>
                <div class="showcase-grenade-pills">
                  <button data-grenade="FRAG" class="btn-grenade-pill active">M67 破片雷 (FRAG)</button>
                  <button data-grenade="FLASH" class="btn-grenade-pill">M84 散光彈 (FLASH)</button>
                  <button data-grenade="SMOKE" class="btn-grenade-pill">M18 煙幕彈 (SMOKE)</button>
                </div>

                <div class="showcase-sec-title">TACTICAL UNIFORM // 戰術部隊迷彩</div>
                <div class="showcase-camo-pills">
                  <button data-camo="MIDNIGHT" class="btn-camo-pill active">暗夜特勤 (MIDNIGHT)</button>
                  <button data-camo="URBAN_WOLF" class="btn-camo-pill">城市灰狼 (URBAN)</button>
                  <button data-camo="DESERT_OPS" class="btn-camo-pill">沙漠突擊 (DESERT)</button>
                </div>

                <div class="showcase-sec-title">SECONDARY MOTION // 次級動態物理預覽</div>
                <div class="showcase-motion-pills">
                  <button data-motion="stop" class="btn-motion-impulse">衝刺急停甩動 (INERTIA STOP)</button>
                  <button data-motion="jump_land" class="btn-motion-impulse">跳躍著地震動 (LAND IMPACT)</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel 2: Briefing & 4 Mode Visual Cards -->
          <div id="setup-panel-briefing" class="setup-panel-content hidden">
            <div class="setup-briefing-layout">
              <div class="setup-intel-card">
                <div class="intel-tag">MISSION BRIEFING // 作戰目標</div>
                <h3 class="intel-title">寒港深水碼頭滲透與防空火控奪還</h3>
                <p class="intel-desc">
                  敵軍 PMC「黑爪部隊」已佔領寒港 4 號碼頭並架設干擾天線。
                  你將率領 Task Force 141 特戰小隊搭乘隱形直升機索降突入，安放 C4 破壞油料庫，
                  並奪回港務主控終端，最後消滅重裝防彈 Juggernaut 首領。
                </p>
                <div class="intel-objectives">
                  <div class="obj-item"><span class="obj-step-num">01</span><span>避開探照燈巡邏，安放 C4 破壞重型油料桶</span></div>
                  <div class="obj-item"><span class="obj-step-num">02</span><span>駭入港務主控終端，解除近迫防空火控系統</span></div>
                  <div class="obj-item"><span class="obj-step-num">03</span><span>消滅 PMC Juggernaut 重裝機槍隊長並呼叫撤離</span></div>
                </div>
              </div>

              <div class="setup-briefing-controls">
                <div class="setup-control-group">
                  <span class="control-group-title">夜港四大作戰模式 (OPERATION MODE):</span>
                  <div class="setup-mode-cards-grid">
                    <div data-setup-mode="RAID" class="mode-visual-card btn-setup-mode-opt active" style="background-image: linear-gradient(180deg, rgba(3,7,18,0.3) 0%, rgba(2,6,23,0.92) 100%), url('assets/modes/mode_raid.jpg');">
                      <div class="mode-badge-pill">3-STAGE INFILTRATION</div>
                      <div class="mode-card-title">戰役突襲 (RAID)</div>
                      <div class="mode-card-desc">夜間集裝箱碼頭索降突入，安放 C4 爆破油料庫，奪回近迫防空火控終端並呼叫黑鷹撤離。</div>
                      <div class="mode-card-rec">推薦: AR-7 突擊步槍 · 全自動壓制</div>
                    </div>
                    <div data-setup-mode="SURVIVAL" class="mode-visual-card btn-setup-mode-opt" style="background-image: linear-gradient(180deg, rgba(3,7,18,0.3) 0%, rgba(2,6,23,0.92) 100%), url('assets/modes/mode_survival.jpg');">
                      <div class="mode-badge-pill gold">ENDLESS DEFENSE</div>
                      <div class="mode-card-title">極限生存 (SURVIVAL)</div>
                      <div class="mode-card-desc">敵軍特種部隊波次圍攻，難度隨波次指數遞增。每波間隔 20 秒戰術補給，檢驗極限防守。</div>
                      <div class="mode-card-rec">推薦: SG-12 破門霰彈槍 · 範圍破點</div>
                    </div>
                    <div data-setup-mode="SNIPER" class="mode-visual-card btn-setup-mode-opt" style="background-image: linear-gradient(180deg, rgba(3,7,18,0.3) 0%, rgba(2,6,23,0.92) 100%), url('assets/modes/mode_sniper.jpg');">
                      <div class="mode-badge-pill cyan">STEALTH HUNT</div>
                      <div class="mode-card-title">潛行暗殺 (SNIPER)</div>
                      <div class="mode-card-desc">利用高架鋼構貓道與吊車制高點，在敵軍未拉響警報前使用消音狙擊逐一肅清目標。</div>
                      <div class="mode-card-rec">推薦: SR-9 狙擊步槍 · 消音器 + 4x鏡</div>
                    </div>
                    <div data-setup-mode="BLITZ" class="mode-visual-card btn-setup-mode-opt" style="background-image: linear-gradient(180deg, rgba(3,7,18,0.3) 0%, rgba(2,6,23,0.92) 100%), url('assets/modes/mode_blitz.jpg');">
                      <div class="mode-badge-pill red">90s SPEEDRUN</div>
                      <div class="mode-card-title">閃擊靶場 (BLITZ)</div>
                      <div class="mode-card-desc">90 秒極速靶場反應測試。精準擊碎紅色戰術敵軍靶，避免誤傷平民靶，挑戰個人紀錄。</div>
                      <div class="mode-card-rec">推薦: SMG-9 衝鋒槍 · 超高連射</div>
                    </div>
                  </div>
                </div>

                <div class="setup-control-group">
                  <span class="control-group-title">戰役難度等級 (DIFFICULTY):</span>
                  <div class="setup-diff-grid">
                    <button data-setup-diff="STANDARD" class="btn-setup-diff-opt active">標準 (STANDARD)</button>
                    <button data-setup-diff="HARDCORE" class="btn-setup-diff-opt">困難 (HARDCORE)</button>
                    <button data-setup-diff="NIGHTMARE" class="btn-setup-diff-opt">極限 (NIGHTMARE)</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel 2: Gunsmith Preview -->
          <div id="setup-panel-gunsmith" class="setup-panel-content hidden">
            <div class="setup-gunsmith-box">
              <div class="wep-preview-card">
                <div class="wep-preview-header">
                  <span class="wep-preview-type">突擊步槍 / PRIMARY WEAPON</span>
                  <div class="wep-preview-title-row">
                    <h3 id="setup-wep-title">AR-7 カービン</h3>
                    <span id="setup-wep-level" class="gunsmith-lvl-badge">LV. 3</span>
                  </div>
                  <p id="setup-wep-desc">標準配發全自動戰術步槍。兼顧中近距離壓制力與穩定後座力，支援瞄具、槍口、握把與彈匣改裝。</p>
                </div>

                <div class="wep-preview-attributes">
                  <div class="wep-attr-pill">威力: <b id="setup-attr-dmg">34</b></div>
                  <div class="wep-attr-pill">連射: <b id="setup-attr-rof">75</b></div>
                  <div class="wep-attr-pill">安定: <b id="setup-attr-stb">72</b></div>
                  <div class="wep-attr-pill">射程: <b id="setup-attr-rng">65</b></div>
                  <div class="wep-attr-pill">彈容: <b id="setup-attr-cap">30</b></div>
                </div>

                <button id="btn-setup-to-gunsmith" class="btn-gold-workbench">
                  開啟 3D 戰術軍械庫改裝 (OPEN WORKBENCH)
                </button>
              </div>
            </div>
          </div>

          <!-- Panel 3: Settings -->
          <div id="setup-panel-settings" class="setup-panel-content hidden">
            <div class="setup-settings-grid">
              <div class="setup-setting-card">
                <div class="setting-title-row">
                  <span class="setting-icon-tag">GYRO</span>
                  <div>
                    <div class="setting-name">手機陀螺儀體感瞄準</div>
                    <div class="setting-sub">傾斜手機微動手腕進行高精度瞄準</div>
                  </div>
                </div>
                <div class="setting-action-row">
                  <button id="setup-btn-gyro-toggle" class="btn-setup-toggle active">陀螺儀: 啟用中 (ON)</button>
                  <button id="setup-btn-gyro-sens" class="btn-setup-cycle">靈敏度: 2.2x</button>
                </div>
              </div>

              <div class="setup-setting-card">
                <div class="setting-title-row">
                  <span class="setting-icon-tag">AUTO</span>
                  <div>
                    <div class="setting-name">智慧自動開火輔助</div>
                    <div class="setting-sub">準星精準對準敵軍身軀時自動扣扳機開火</div>
                  </div>
                </div>
                <div class="setting-action-row">
                  <button id="setup-btn-autofire-toggle" class="btn-setup-toggle active">自動開火: 啟用中 (ON)</button>
                </div>
              </div>

              <div class="setup-setting-card">
                <div class="setting-title-row">
                  <span class="setting-icon-tag">HAPTIC</span>
                  <div>
                    <div class="setting-name">手機觸覺震動回饋</div>
                    <div class="setting-sub">射擊後座力、受傷重擊與換彈卡榫之細膩觸感</div>
                  </div>
                </div>
                <div class="setting-action-row">
                  <button id="setup-btn-haptics-toggle" class="btn-setup-toggle active">震動回饋: 啟用中 (ON)</button>
                </div>
              </div>

              <div class="setup-setting-card">
                <div class="setting-title-row">
                  <span class="setting-icon-tag">HUD</span>
                  <div>
                    <div class="setting-name">手遊觸控鍵位工坊</div>
                    <div class="setting-sub">自訂按鈕位置、縮放大小 (70%~150%) 與透明度</div>
                  </div>
                </div>
                <div class="setting-action-row">
                  <button id="setup-btn-hud-editor" class="btn-setup-action">開啟鍵位與體感工坊</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Action Bar -->
          <div class="setup-footer">
            <button id="btn-setup-back" class="btn-setup-back">返回首頁</button>
            <button id="btn-setup-deploy" class="btn-setup-deploy">
              <span class="btn-deploy-pulse"></span>
              <span class="btn-deploy-text">確認出擊 // COMMENCE INFILTRATION</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(setupEl);
    }
    this.setupModal = setupEl;

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
            <span class="preload-version-pill">BUILD v2.0.0</span>
          </div>
          <div class="preload-stage-row">
            <span id="preload-stage-label" class="preload-stage-label">[v2.0.0] STEP 1/7 · DOWNLOADING ASSETS...</span>
            <span id="preload-stage-pct" class="preload-stage-pct">0%</span>
          </div>
          <div class="preload-line-track">
            <div id="preload-line-fill" class="preload-line-fill"></div>
          </div>
          <div id="preload-stage-hint" class="preload-stage-hint">${TACTICAL_TIPS[0]}</div>
          <div class="preload-footer-ver">FIREGUN TACTICAL ENGINE · CLIENT v2.0.0-TACTICAL</div>
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
            <span class="pause-code">GRID K2 · PACIFIC TIME 02:40 · BUILD v2.0.0</span>
          </div>
          <div class="pause-actions">
            <button id="btn-pause-resume" class="btn-pause-act btn-pause-primary">RESUME OPERATION // 繼續作戰</button>
            <button id="btn-pause-gunsmith" class="btn-pause-act">戰術軍械庫 (GUNSMITH WORKBENCH)</button>
            <button id="btn-pause-hud-editor" class="btn-pause-act">鍵位自訂與體感 (CUSTOM TOUCH & GYRO)</button>
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
            <span class="unlock-icon">UNLOCKED</span>
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
            <button id="btn-reward-redeploy" class="btn-reward-primary">再次出擊 (REDEPLOY)</button>
            <button id="btn-reward-gunsmith" class="btn-reward-sec">槍匠改裝 (GUNSMITH)</button>
            <button id="btn-reward-main" class="btn-reward-sub">返回主選單</button>
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
    this.isDeploying = false;
    this.onDeployCallback = onDeploy;
    if (onGunsmith) this.onGunsmithCallback = onGunsmith;

    const btnText = this.titlePortal?.querySelector('.btn-portal-text');
    if (btnText) {
      btnText.textContent = '開始遊戲 // START OPERATION';
    }

    if (this.portalDeployPending) {
      this.portalDeployPending = false;
      this.triggerDeployAction();
      return;
    }

    if (!this.titlePortal) return;
    this.titlePortal.classList.remove('hidden');

    const deployBtn = document.getElementById('btn-portal-deploy');
    this.bindPortalTap(deployBtn, (e) => this.triggerDeployAction(e));

    const operatorBtn = document.getElementById('btn-portal-operator');
    this.bindPortalTap(operatorBtn, (e) => this.triggerDeployAction(e));

    // Tap anywhere on the portal backdrop/screen to start
    this.bindPortalTap(this.titlePortal, (e) => {
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

  public showTacticalSetup(options: TacticalSetupOptions) {
    this.setupOptions = options;
    if (!this.setupModal) return;
    this.setupModal.classList.remove('hidden');

    // Update header credits
    const creditsEl = document.getElementById('setup-credits-val');
    if (creditsEl && options.credits !== undefined) {
      creditsEl.textContent = `${options.credits.toLocaleString()} CR`;
    }

    // Update weapon preview
    const wepTitle = document.getElementById('setup-wep-title');
    const wepLvl = document.getElementById('setup-wep-level');
    const wepDesc = document.getElementById('setup-wep-desc');
    if (wepTitle && options.activeWeaponName) wepTitle.textContent = options.activeWeaponName;
    if (wepLvl && options.activeWeaponLevel !== undefined) wepLvl.textContent = `LV. ${options.activeWeaponLevel}`;
    if (wepDesc && options.activeWeaponDesc) wepDesc.textContent = options.activeWeaponDesc;

    if (options.activeWeaponStats) {
      const s = options.activeWeaponStats;
      const dmg = document.getElementById('setup-attr-dmg');
      const rof = document.getElementById('setup-attr-rof');
      const stb = document.getElementById('setup-attr-stb');
      const rng = document.getElementById('setup-attr-rng');
      const cap = document.getElementById('setup-attr-cap');
      if (dmg) dmg.textContent = String(s.dmg);
      if (rof) rof.textContent = String(s.rof);
      if (stb) stb.textContent = String(s.stb);
      if (rng) rng.textContent = String(s.rng);
      if (cap) cap.textContent = String(s.cap);
    }

    // Update active mode and difficulty buttons
    this.updateSetupModeAndDiffUi(options.currentMode, options.currentDifficulty);

    // Update gyro & autofire status
    this.updateSetupControlsUi(options.gyroEnabled, options.gyroSens, options.autofireEnabled);

    // Bind Tabs
    const tabBriefing = document.getElementById('setup-tab-btn-briefing');
    const tabOperator = document.getElementById('setup-tab-btn-operator');
    const tabGunsmith = document.getElementById('setup-tab-btn-gunsmith');
    const tabSettings = document.getElementById('setup-tab-btn-settings');
    const panelBriefing = document.getElementById('setup-panel-briefing');
    const panelOperator = document.getElementById('setup-panel-operator');
    const panelGunsmith = document.getElementById('setup-panel-gunsmith');
    const panelSettings = document.getElementById('setup-panel-settings');

    const switchTab = (tabName: 'briefing' | 'operator' | 'gunsmith' | 'settings') => {
      tabBriefing?.classList.toggle('active', tabName === 'briefing');
      tabOperator?.classList.toggle('active', tabName === 'operator');
      tabGunsmith?.classList.toggle('active', tabName === 'gunsmith');
      tabSettings?.classList.toggle('active', tabName === 'settings');

      panelBriefing?.classList.toggle('active', tabName === 'briefing');
      panelBriefing?.classList.toggle('hidden', tabName !== 'briefing');

      panelOperator?.classList.toggle('active', tabName === 'operator');
      panelOperator?.classList.toggle('hidden', tabName !== 'operator');

      panelGunsmith?.classList.toggle('active', tabName === 'gunsmith');
      panelGunsmith?.classList.toggle('hidden', tabName !== 'gunsmith');

      panelSettings?.classList.toggle('active', tabName === 'settings');
      panelSettings?.classList.toggle('hidden', tabName !== 'settings');

      if (tabName === 'operator') {
        options.onOpenOperatorShowcase?.();
      }
    };

    if (tabBriefing) {
      tabBriefing.onclick = () => switchTab('briefing');
      tabBriefing.ontouchend = () => switchTab('briefing');
    }
    if (tabOperator) {
      tabOperator.onclick = () => switchTab('operator');
      tabOperator.ontouchend = () => switchTab('operator');
    }
    if (tabGunsmith) {
      tabGunsmith.onclick = () => switchTab('gunsmith');
      tabGunsmith.ontouchend = () => switchTab('gunsmith');
    }
    if (tabSettings) {
      tabSettings.onclick = () => switchTab('settings');
      tabSettings.ontouchend = () => switchTab('settings');
    }

    // Default trigger Operator Showcase if operator tab is active initially
    if (tabOperator?.classList.contains('active')) {
      options.onOpenOperatorShowcase?.();
    }

    // Bind Mode buttons
    document.querySelectorAll<HTMLElement>('.btn-setup-mode-opt').forEach((btn) => {
      const onMode = (e: Event) => {
        e.stopPropagation();
        const m = btn.dataset.setupMode as 'RAID' | 'SURVIVAL' | 'SNIPER' | 'BLITZ';
        if (m && options.onModeChange) {
          options.onModeChange(m);
          this.updateSetupModeAndDiffUi(m, options.currentDifficulty);
        }
      };
      btn.onclick = onMode;
      btn.ontouchend = onMode;
    });

    // Bind Difficulty buttons
    document.querySelectorAll<HTMLElement>('.btn-setup-diff-opt').forEach((btn) => {
      const onDiff = (e: Event) => {
        e.stopPropagation();
        const d = btn.dataset.setupDiff as 'STANDARD' | 'HARDCORE' | 'NIGHTMARE';
        if (d && options.onDifficultyChange) {
          options.onDifficultyChange(d);
          this.updateSetupModeAndDiffUi(options.currentMode, d);
        }
      };
      btn.onclick = onDiff;
      btn.ontouchend = onDiff;
    });

    // Bind Open Gunsmith
    const openWepBtn = document.getElementById('btn-setup-to-gunsmith');
    if (openWepBtn) {
      const onOpenGunsmith = (e: Event) => {
        e.stopPropagation();
        options.onOpenGunsmith();
      };
      openWepBtn.onclick = onOpenGunsmith;
      openWepBtn.ontouchend = onOpenGunsmith;
    }

    // Bind Gyro & Autofire
    const gyroBtn = document.getElementById('setup-btn-gyro-toggle');
    if (gyroBtn) {
      const onGyro = (e: Event) => {
        e.stopPropagation();
        options.onGyroToggle();
      };
      gyroBtn.onclick = onGyro;
      gyroBtn.ontouchend = onGyro;
    }

    const gyroSensBtn = document.getElementById('setup-btn-gyro-sens');
    if (gyroSensBtn) {
      const onSens = (e: Event) => {
        e.stopPropagation();
        options.onGyroSensCycle();
      };
      gyroSensBtn.onclick = onSens;
      gyroSensBtn.ontouchend = onSens;
    }

    const autoBtn = document.getElementById('setup-btn-autofire-toggle');
    if (autoBtn) {
      const onAuto = (e: Event) => {
        e.stopPropagation();
        options.onAutofireToggle();
      };
      autoBtn.onclick = onAuto;
      autoBtn.ontouchend = onAuto;
    }

    const hapticsBtn = document.getElementById('setup-btn-haptics-toggle');
    if (hapticsBtn) {
      const onHaptics = (e: Event) => {
        e.stopPropagation();
        options.onHapticsToggle();
      };
      hapticsBtn.onclick = onHaptics;
      hapticsBtn.ontouchend = onHaptics;
    }

    const hudEditorBtn = document.getElementById('setup-btn-hud-editor');
    if (hudEditorBtn) {
      const onHud = (e: Event) => {
        e.stopPropagation();
        options.onOpenHudEditor();
      };
      hudEditorBtn.onclick = onHud;
      hudEditorBtn.ontouchend = onHud;
    }

    // Back to title
    const backBtn = document.getElementById('btn-setup-back');
    if (backBtn) {
      const onBack = (e: Event) => {
        e.stopPropagation();
        options.onBackToTitle();
      };
      backBtn.onclick = onBack;
      backBtn.ontouchend = onBack;
    }

    // Deploy Operator
    const deployBtn = document.getElementById('btn-setup-deploy');
    if (deployBtn) {
      const onDeploy = (e: Event) => {
        e.stopPropagation();
        this.triggerWhiteFlash();
        options.onDeploy();
      };
      deployBtn.onclick = onDeploy;
      deployBtn.ontouchend = onDeploy;
    }
  }

  public hideTacticalSetup() {
    this.setupModal?.classList.add('hidden');
  }

  public updateSetupModeAndDiffUi(mode: string, diff: string) {
    document.querySelectorAll<HTMLElement>('.btn-setup-mode-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.setupMode === mode);
    });
    document.querySelectorAll<HTMLElement>('.btn-setup-diff-opt').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.setupDiff === diff);
    });
  }

  public updateSetupControlsUi(gyroEnabled: boolean, gyroSens: number, autofire: boolean, hapticsEnabled = true) {
    const gyroBtn = document.getElementById('setup-btn-gyro-toggle');
    if (gyroBtn) {
      gyroBtn.classList.toggle('active', gyroEnabled);
      gyroBtn.textContent = `陀螺儀: ${gyroEnabled ? '啟用中 (ON)' : '已關閉 (OFF)'}`;
    }
    const sensBtn = document.getElementById('setup-btn-gyro-sens');
    if (sensBtn) {
      sensBtn.textContent = `靈敏度: ${gyroSens.toFixed(1)}x`;
    }
    const autoBtn = document.getElementById('setup-btn-autofire-toggle');
    if (autoBtn) {
      autoBtn.classList.toggle('active', autofire);
      autoBtn.textContent = `自動開火: ${autofire ? '啟用中 (ON)' : '已關閉 (OFF)'}`;
    }
    const hapticsBtn = document.getElementById('setup-btn-haptics-toggle');
    if (hapticsBtn) {
      hapticsBtn.classList.toggle('active', hapticsEnabled);
      hapticsBtn.textContent = `震動回饋: ${hapticsEnabled ? '啟用中 (ON)' : '已關閉 (OFF)'}`;
    }
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
      this.preloadLabel.textContent = `[v2.0.0] STEP ${status.step}/${status.totalSteps} · ${status.label}`;
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
    onClose?: () => void;
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
      options.onClose?.();
    });
  }
}

