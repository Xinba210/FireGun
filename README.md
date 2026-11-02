# FireGun — 夜間港口軍事行動 (Night Port Military Operation)

**FireGun** 是一款採用 **AGY + Blender + Pixal3D + RigForge (CC0 Quaternius/KayKit) + Three.js (WebGL2) + Godot 4.7** 雙引擎架構開發的寫實第一人稱軍事射擊遊戲（Realistic FPS）。首個垂直切片關卡為 **「夜間港口軍事行動 (Operation Midnight Harbor)」**。

---

## 一、專案架構與目錄說明

```text
d:\AGY Project\FireGun\
├─ .agents/skills/realistic-fps-port-pipeline/SKILL.md  # 本專案專屬寫實 FPS 開發與品質驗收 Skill
├─ .claude/skills/realistic-fps-port-pipeline/SKILL.md  # Claude/AGY 相容 Skill 鏡像
├─ blueprints/
│  └─ night_port.json                                   # 關卡空間藍圖、固定參考鏡位 (hero/lane/view1..8) 與巡邏路線
├─ reference/concept/                                   # AGY 生成之原始 16:9 概念圖與設定稿
│  ├─ port_overview_hero.jpg                            # 夜間港口全景概念圖 (Pitch 26°)
│  ├─ port_combat_lane_mid.jpg                          # 西側碼頭戰鬥走廊概念圖 (Eye-level)
│  ├─ weapon_carbine_sheet.jpg                          # AR-7 戰術步槍三視圖概念稿
│  └─ soldier_tactical_sheet.jpg                        # 戰術士兵嚴格水平 T-Pose 概念稿
├─ assets/source_cc0/                                   # 原始 CC0 骨骼角色與 43 組動作庫來源 (含 LICENSE.txt)
├─ public/assets/
│  ├─ models/
│  │  ├─ port_environment.glb                           # 夜間港口模組化 3D PBR 場景資產 (含法線/粗糙度/金屬度貼圖)
│  │  ├─ weapons_pack.glb                               # 3 把高精度 PBR 武器 (AR-7 / SR-9 / RL-7)
│  │  └─ soldier_tactical_animated.glb                  # 65 骨骼 CC0 戰術士兵 + 43 組動作 + hand_r 武器綁定
│  ├─ audio/                                            # 13 組無版權程序化 3D 空間音效 (.wav)
│  └─ licenses/                                         # Quaternius 與 KayKit CC0 1.0 授權證明文件
├─ src/
│  ├─ main.ts                                           # Three.js WebGL2 可遊玩 FPS 關卡、AI、物理碰撞、HUD 與 3D 音效
│  └─ style.css                                         # 現代軍事戰術 HUD、8x 狙擊鏡、3D 武器庫與任務結算介面
├─ godot/                                               # Godot 4.7 正式 FPS 遊戲專案 (共用驗證後 GLB 與 WAV 資產)
│  ├─ project.godot                                     # Godot 4.7 Forward+ 專案設定與輸入映射
│  ├─ scenes/NightPortMain.tscn                         # 夜間港口主場景
│  ├─ scripts/
│  │  ├─ night_port_level.gd                            # 關卡裝載、燈光、積水、敵人生成與 HUD 管理
│  │  ├─ player_fps.gd                                  # CharacterBody3D 第一人稱移動、ADS、後座力、換彈與射線判定
│  │  └─ enemy_soldier.gd                               # 敵軍 AI 狀態機 (PATROL / ALERT / CHASE / ATTACK / DEAD)
│  └─ assets/                                           # 與 Web 版同步之 GLB 模型與 3D 空間音效
├─ tools/
│  ├─ build_assets_glb.mjs                              # PBR 材質紋理生成、場景/武器建模與 CC0 65 骨骼士兵組裝管線
│  ├─ build_audio_wav.mjs                               # 13 組武器/環境/腳步/爆破 WAV 音效合成器
│  ├─ blender/verify_and_build_blender.py               # Blender 4.2+ 無頭 UV/法線/軸向/碰撞驗證腳本
│  └─ qa/verify_fps.mjs                                 # 自動化硬體 GPU A/B 鏡位比對、9 視角截圖、MP4 錄影與效能檢測
└─ docs/
   ├─ SKILL_VERIFICATION.md                             # 本機 4 大指定 Skill 真實絕對路徑與驗證紀錄
   ├─ optimization-runs/V0.1.0-vertical-slice.md        # 品質優化循環報告 (Before/After 比較與實測數據)
   └─ evidence/v0.1.0/                                  # 實機截圖、同鏡位 A/B 比對、動態 MP4 錄影與 perf_report.json
```

---

## 二、快速啟動與驗證指令

### 1. 啟動 Three.js WebGL2 互動測試平台

```powershell
npm.cmd install
npm.cmd run dev
```

### 2. 重新建置 3D GLB 資產、音效與執行完整硬體 GPU 自動化驗收

```powershell
node tools/build_assets_glb.mjs
node tools/build_audio_wav.mjs
npm.cmd run build
node tools/qa/verify_fps.mjs
```

### 3. 開啟 Godot 4.7 正式遊戲專案

使用 Godot Engine 4.3+ / 4.7 開啟 `d:\AGY Project\FireGun\godot\project.godot`，直接執行主場景 `res://scenes/NightPortMain.tscn`。

---

## 三、操作說明 (Controls)

| 按鍵 / 滑鼠 | 功能說明 |
| :--- | :--- |
| `W` `A` `S` `D` | 前後左右移動（自動觸發混凝土或積水 3D 腳步聲） |
| `Shift` | 戰術衝刺 (Sprint) |
| `Space` | 跳躍（可登上 5.3m 高架鋼製走道與貨櫃跳台） |
| `C` | 戰術蹲下 (Crouch，降低視角高度與後座力擴散) |
| `滑鼠左鍵 (LMB)` | 武器射擊（支援爆頭 2.2x–3.0x 傷害與紅色油桶連鎖引爆） |
| `滑鼠右鍵 (RMB)` | 舉槍瞄準 (ADS：全息紅點瞄具 / `SR-9` 8倍測距狙擊鏡) |
| `R` | 戰術換彈 (Reload) |
| `1` / `2` / `3` | 切換武器：`1` AR-7 突擊步槍 / `2` SR-9 狙擊步槍 / `3` RL-7 火箭筒 |
| `L` | 開啟 / 關閉 3D 武器庫檢視介面 (`LOADOUT` 360° 旋轉檢視) |
| `M` | 任務結算畫面預覽 (`MISSION COMPLETE`) |
