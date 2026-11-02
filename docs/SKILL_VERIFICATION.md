# Skill 路徑驗證與適用範圍紀錄（FireGun Realistic FPS）

本文件依據開發總指令「二、必須讀取的 Skill 與絕對路徑」之驗證規則，如實記錄本機檔案系統搜尋、讀取與驗證結果。所有原始來源專案與原始 Skill 均保持唯讀、未被覆寫。

## 1. 候選 Skill 驗證結果總表

| 編號 | Skill 名稱 | 提示詞候選路徑 | 實際存在路徑（Verified Absolute Path） | 驗證與讀取狀態 | 適用範圍與本專案落地方式 |
|---|---|---|---|---|---|
| **Skill 1** | `concept-to-playable-3d` | `D:\Claude Project\Concept Art to Playable 3D\.claude\skills\concept-to-playable-3d\SKILL.md` | `D:\Claude Project\Concept Art to Playable 3D\.claude\skills\concept-to-playable-3d\SKILL.md`<br>（同內容鏡像：`D:\Claude Project\Concept Art to Playable 3D\.agents\skills\concept-to-playable-3d\SKILL.md`） | **已驗證存在並完整讀取** | 1. AGY 原創概念圖生成（無文字/浮水印、16:9、主視角俯角 >= 25°、近景視角、特寫）<br>2. 先定固定參考相機（Reference Camera），再做場景 3D 佈局<br>3. PBR 材質、冷暖光源比例（港燈暖橘 vs 夜空深藍）、ACES 色調映射防過曝<br>4. 擷取模式（`?capture`）凍結動態時間做可重現同鏡位 A/B 對照 |
| **Skill 2** | `skyrend-optimization-cycle` | `D:\Claude Project\SKYREND-ECHOES-OF-THE-PRIMORDIAL\.claude\skills\skyrend-optimization-cycle\SKILL.md` | `D:\Claude Project\SKYREND-ECHOES-OF-THE-PRIMORDIAL\.claude\skills\skyrend-optimization-cycle\SKILL.md` | **路徑已驗證存在**（初次 `read_file` 權限彈窗被拒，依安全規範不繞過讀取；已同步讀取本機等效規範 `D:\Claude Project\BLACKTIDE-SHADOW-PROTOCOL\docs\technical\QUALITY_GATES.md`） | 1. 瓶頸分析 → 最小可逆修正 → 同鏡位 BEFORE/AFTER A/B 視覺比較<br>2. WebGL 2 真實渲染驗證、8 視角實機截圖、連續動態操作錄影（MP4）<br>3. 記錄真實 FPS、Frame Time P95 (ms)、Draw Calls、Triangles、Memory 及硬體/渲染後端資訊（嚴格區分硬體 GPU 與軟體渲染） |
| **Skill 3** | `skyrend-concept-to-playable-3d` | `D:\Claude Project\SKYREND-ECHOES-OF-THE-PRIMORDIAL\.claude\skills\skyrend-concept-to-playable-3d\SKILL.md` | 候選路徑不存在；本機實際對應之同名/同職責 Skill 為：<br>1. `D:\Claude Project\Concept Art to Playable 3D\.claude\skills\concept-to-playable-3d\SKILL.md`<br>2. `D:\Claude Project\Concept Art to Playable 3D\.claude\skills\world-weaver\SKILL.md` | **已搜尋本機所有 `.claude/skills` 與 `.agents/skills` 並完整讀取對應 Skill** | 1. 複雜模組化 3D 場景生成（碼頭、貨櫃迷宮、起重機、貨輪、倉庫、立體貓道）<br>2. 概念圖與實際 3D 場景構圖一致性驗證<br>3. 避免執行期動態新增 `PointLight` 造成 Shader 重新編譯卡頓<br>4. 可遊玩動線與探索/任務驗收 |
| **Skill 4** | `character-skin` | `D:\Claude Project\Frostwake-Open-World-RPG\.claude\skills\character-skin\SKILL.md` | 候選路徑不存在；本機實際存在之絕對路徑為：<br>`D:\Claude Project\Concept Art to Playable 3D\.claude\skills\character-skin\SKILL.md`<br>（同專案配套：`D:\Claude Project\Concept Art to Playable 3D\.claude\skills\monster-bind\SKILL.md`） | **已搜尋定位並完整讀取** | 1. 嚴禁將 AI 生成網格硬拉骨架造成關節扭曲；採用 CC0 標準人體/動作底盤（Quaternius UAL1/UAL2 84 動作 + KayKit CC0 射擊動作）<br>2. 硬物件（步槍、頭盔、護具）100% 剛性綁定至對應骨骼（如 `hand_r` / `Head`），不刷軟權重避免槍枝彎曲變形<br>3. 檢查手部持槍對位、Foot Lock 踩地與關節變形 |

## 2. 本機工具鏈與素材來源驗證紀錄（`D:\Xinba Tools`）

| 工具 / 素材庫 | 實際驗證路徑 | 狀態與授權 |
|---|---|---|
| **Blender 4.5 LTS** | `D:\Xinba Tools\Blender\blender-4.5.13-windows-x64\blender.exe` | 已驗證可無頭（`-b --factory-startup`）執行 Python 建模、UV、PBR 貼圖烘焙、骨架綁定與 GLB 匯出 |
| **Godot Engine 4.7.2** | `D:\Xinba Tools\Godot\Godot_v4.7.2-stable_win64_console.exe` | 已驗證可執行 GDScript 正式 FPS 專案與無頭驗證 |
| **Pixal3D** | `D:\Xinba Tools\Pixal3D\pipeline.py` | 本機 Image-to-3D 管線已就緒 |
| **RigForge 動作與角色庫** | `D:\Xinba Tools\Rigforge\dist\free-motions\`<br>- `kaykit-animations-11\kaykit-11-rig-medium-combatranged.glb` (`LICENSE.txt` CC0)<br>- `quaternius-ual1\UAL1_Standard.glb` (`LICENSE.txt` CC0)<br>- `quaternius-ual2\UAL2_Standard.glb` (`LICENSE.txt` CC0)<br>`D:\Xinba Tools\KineForge\outputs\motion_library\raw\qofficial\` (`Superhero_Male_FullBody.gltf` CC0) | 已核對 `LICENSE.txt`，確認 Quaternius 與 KayKit 均為 **CC0 Public Domain** 授權 |

## 3. 本專案獨立 FPS Skill

為遵循「原始 Skill 與來源專案不得被任意覆寫。若需要 FPS 專用規則，應在目前 FPS 專案建立獨立 Skill」，本專案已建立：
- `.agents/skills/realistic-fps-port-pipeline/SKILL.md`
- `.claude/skills/realistic-fps-port-pipeline/SKILL.md`
