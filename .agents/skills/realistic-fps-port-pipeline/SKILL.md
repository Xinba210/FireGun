---
name: realistic-fps-port-pipeline
description: FireGun 寫實第一人稱射擊遊戲（夜間港口軍事行動）專用開發與品質驗收 Skill。結合 concept-to-playable-3d、character-skin 與 FPS 專屬視覺/動畫/射擊/效能門檻，適用於 Three.js Web 測試平台與 Godot 4.7 正式遊戲系統。
---

# Realistic FPS Port Pipeline（FireGun 專用 Skill）

本 Skill 整合自本機已驗證之 `concept-to-playable-3d`、`world-weaver`、`character-skin`、`monster-bind` 與 FPS 品質門檻，專供 `d:\AGY Project\FireGun` 專案使用，不修改任何外部來源專案。

## 1. 核心管線順序

1. **AGY 原創概念圖（`reference/concept/`）**：
   - 產生無文字、無浮水印之 16:9 原創概念圖：
     - `port_overview_hero.png`：夜間港口全局構圖（俯角 >= 25°，含貨輪、起重機、貨櫃區、倉庫、哨站、積水反射、火桶、戰鬥動線）。
     - `port_combat_lane_mid.png`：第一人稱高度之碼頭戰鬥走廊近景。
     - `weapon_carbine_sheet.png`：現代戰術步槍多視角建模參考圖。
     - `soldier_tactical_sheet.png`：現代戰術士兵嚴格 T-pose 正背面參考圖。
2. **Blender 4.5 + PBR 資產製作（`tools/blender/` -> `public/assets/models/`）**：
   - 所有建築、貨櫃、起重機、貨輪、武器均由 Blender 產生真實 3D 網格、UV 與 PBR 貼圖（Albedo、Normal、Roughness、Metallic），匯出標準 GLB（`port_environment.glb`、`weapons_pack.glb`）。
   - 禁止單純用無紋理方塊或單張 AI 圖片冒充 3D 場景。
3. **CC0 士兵套皮與剛性武器掛載（`character-skin` 規範）**：
   - 使用 `D:\Xinba Tools\Rigforge\dist\free-motions\` 與 `KineForge` 內經授權驗證之 CC0 骨架與動作（KayKit / Quaternius CC0）。
   - 士兵戰術裝備與武器採剛性綁定至骨骼（步槍 100% 綁定右手骨，頭盔/戰術背心剛性對齊），不刷軟權重避免槍身變形。
   - 驗證站立、巡邏行走、奔跑、蹲下、瞄準、射擊、換彈、受擊與死亡倒地動畫，確保腳底不浮空穿地。
4. **Three.js 實機預覽與測試平台（`src/`）**：
   - 固定參考相機（`?cam=hero`、`?cam=lane`、`?cam=view1..view8`）與 `?capture` 凍結時間模式，支援可重現同鏡位 A/B 比對。
   - 實作完整第一人稱移動、衝刺、蹲下、跳躍、滑鼠瞄準（ADS 全息鏡 / 狙擊鏡測距）、射擊後座力、彈殼拋出、換彈、三把武器切換（AR-7 突擊步槍、SR-9 狙擊步槍、RL-7 火箭筒）、3D Loadout 檢視、油桶引爆、敵人 AI 狀態機（巡邏/警戒/追擊/掩體射擊/倒地）、小地圖與任務結算。
5. **Godot 4.7 正式 FPS 遊戲系統（`godot/`）**：
   - 匯入相同驗證過之 GLB 模型與 3D 空間音效（`AudioStreamPlayer3D`），實作正式 CharacterBody3D FPS 控制器、武器系統、敵人 AI、HUD 與任務系統。
6. **強制品質優化循環與驗收證據（`docs/evidence/`）**：
   - 每輪必須產出：AGY 概念圖、同鏡位 A/B 比對圖、港口至少 8 個實機視角截圖、動態操作與 AI 戰鬥 MP4 錄影、真實 FPS / P95 / Draw Calls / Triangles 效能報告。
   - 嚴格區分硬體 GPU 與軟體渲染數據，不偽造效能指標。
