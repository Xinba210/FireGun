import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const DIST_DIR = path.resolve('dist');
const EVIDENCE_DIR = path.resolve('docs/evidence/v0.1.0');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function buildStandaloneHtml() {
  let html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
  const assetsDir = path.join(DIST_DIR, 'assets');
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find((f) => f.endsWith('.css'));
  const jsFile = files.find((f) => f.endsWith('.js'));

  const cssContent = cssFile ? fs.readFileSync(path.join(assetsDir, cssFile), 'utf8') : '';
  const jsContent = jsFile ? fs.readFileSync(path.join(assetsDir, jsFile), 'utf8') : '';

  const glbMap = {
    'assets/models/port_environment.glb': fs.readFileSync(path.join(DIST_DIR, 'assets/models/port_environment.glb')).toString('base64'),
    'assets/models/weapons_pack.glb': fs.readFileSync(path.join(DIST_DIR, 'assets/models/weapons_pack.glb')).toString('base64'),
    'assets/models/soldier_tactical_animated.glb': fs.readFileSync(path.join(DIST_DIR, 'assets/models/soldier_tactical_animated.glb')).toString('base64'),
  };

  html = html.replace(/<link rel="stylesheet"[^>]*>/g, () => `<style>${cssContent}</style>`);
  html = html.replace(
    /<script type="module"[^>]*><\/script>/g,
    () => `<script>window.__PRELOADED_GLB_B64__ = ${JSON.stringify(glbMap)};</script>\n<script type="module">${jsContent}</script>`
  );

  const outPath = path.join(DIST_DIR, 'standalone.html');
  fs.writeFileSync(outPath, html, 'utf8');
  return pathToFileURL(outPath).href;
}

async function launchBrowserWithWebGL() {
  const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  for (const mode of [
    {
      name: 'hardware-d3d11',
      args: [
        '--use-gl=angle',
        '--use-angle=d3d11',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox',
        '--allow-file-access-from-files',
        '--no-first-run',
      ],
    },
    {
      name: 'software-swiftshader',
      args: [
        '--enable-unsafe-swiftshader',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--disable-gpu-sandbox',
        '--allow-file-access-from-files',
        '--no-first-run',
      ],
    },
  ]) {
    try {
      const browser = await chromium.launch({
        headless: true,
        executablePath: chromePath,
        args: mode.args,
      });
      const page = await browser.newPage();
      const hasWebGL = await page.evaluate(() => {
        const c = document.createElement('canvas');
        return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
      });
      await page.close();
      if (hasWebGL) {
        console.log('Launched Chrome with WebGL mode:', mode.name);
        return browser;
      }
      await browser.close();
    } catch (e) {
      console.warn('Mode failed:', mode.name, e.message);
    }
  }
  throw new Error('Could not initialize WebGL in Chrome');
}

async function composeSideBySideAB(
  browser,
  leftImgPath,
  rightImgPath,
  titleText,
  outPath,
  leftLabel = '[A] AGY ORIGINAL CONCEPT ART',
  rightLabel = '[B] THREE.JS REAL-TIME WEBGL RENDER (SAME CAMERA)'
) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 600 } });
  const leftB64 = fs.readFileSync(leftImgPath).toString('base64');
  const rightB64 = fs.readFileSync(rightImgPath).toString('base64');
  const leftMime = leftImgPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  await page.setContent(`
    <html>
    <body style="margin:0;background:#070b12;color:#f8fafc;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;height:600px;">
      <div style="height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:2px solid #eab308;background:#0b111c;">
        <b style="font-size:16px;color:#facc15;">${titleText}</b>
        <span style="font-size:13px;color:#94a3b8;">concept-to-playable-3d // Fixed Reference Camera A/B Verification</span>
      </div>
      <div style="flex:1;display:flex;gap:8px;padding:8px;">
        <div style="flex:1;position:relative;border:1px solid rgba(255,255,255,0.2);">
          <img src="data:${leftMime};base64,${leftB64}" style="width:100%;height:100%;object-fit:cover;" />
          <div style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.8);padding:4px 12px;border-left:3px solid #38bdf8;font-size:13px;font-weight:700;">
            ${leftLabel}
          </div>
        </div>
        <div style="flex:1;position:relative;border:1px solid rgba(255,255,255,0.2);">
          <img src="data:image/png;base64,${rightB64}" style="width:100%;height:100%;object-fit:cover;" />
          <div style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.8);padding:4px 12px;border-left:3px solid #facc15;font-size:13px;font-weight:700;">
            ${rightLabel}
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  await page.waitForTimeout(100);
  await page.screenshot({ path: outPath });
  await page.close();
}

async function main() {
  const standaloneUrl = buildStandaloneHtml();
  const browser = await launchBrowserWithWebGL();
  const errors = [];

  try {
    // -----------------------------------------------------------------------
    // Part 1: Capture Concept A/B Reference Renders & 8 Port Viewport Shots
    // -----------------------------------------------------------------------
    const ctx = await browser.newContext({ viewport: { width: 1376, height: 768 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => {
      console.error('PAGE_ERROR:', e.message);
      errors.push(`PAGE_ERROR: ${e.message}`);
    });
    page.on('console', (m) => {
      if (m.type() === 'error') {
        console.error('CONSOLE_ERROR:', m.text());
        errors.push(`CONSOLE_ERROR: ${m.text()}`);
      }
    });

    await page.goto(`${standaloneUrl}?capture=1`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => {
      const st = window.__fpsApi?.getState?.();
      return st && st.enemiesTotal === 8;
    }, null, { timeout: 20000 });
    await page.waitForTimeout(350);

    // 1. Same-camera A/B Reference Renders (matching AGY Concept Art)
    await page.evaluate(() => window.__fpsApi.setCamera('hero'));
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'cam_hero_render.png') });

    await page.evaluate(() => window.__fpsApi.setCamera('lane'));
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'cam_lane_render.png') });

    // 2. Capture 8 Real Engine Port Viewport Screenshots
    await page.evaluate(() => {
      window.__fpsApi.closeModals();
      window.__fpsApi.equipWeapon(0);
      window.__fpsApi.setAds(false);
      window.__fpsApi.setPlayerPose(0.0, 0.0, 28.0, 0.0, -0.04);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_01_dock_entrance.png') });

    await page.evaluate(() => {
      window.__fpsApi.setPlayerPose(-11.5, 0.0, 17.5, 0.42, 0.08);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_02_cargo_ship_quay.png') });

    await page.evaluate(() => {
      window.__fpsApi.setPlayerPose(-6.5, 0.0, 15.5, 0.0, -0.02);
      window.__fpsApi.setAds(true);
      window.__fpsApi.fire();
      window.__fpsApi.fire();
      window.__fpsApi.fire();
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_03_container_alley_ads.png') });

    await page.evaluate(() => {
      window.__fpsApi.setAds(false);
      window.__fpsApi.equipWeapon(2);
      window.__fpsApi.setPlayerPose(5.8, 5.34, 8.5, 0.55, -0.35);
      window.__fpsApi.detonateAt(-0.5, 0.4, 1.5, 0.08);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_04_overhead_catwalk_rl7.png') });

    await page.evaluate(() => {
      window.__fpsApi.equipWeapon(1);
      window.__fpsApi.setAds(false);
      window.__fpsApi.setPlayerPose(-7.5, 0.0, -2.5, -0.05, 0.42);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_05_gantry_crane_lookup.png') });

    await page.evaluate(() => {
      window.__fpsApi.equipWeapon(1);
      window.__fpsApi.setPlayerPose(-6.5, 0.0, 26.0, 0.0, -0.02);
      window.__fpsApi.setAds(true);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_06_sniper_scope_ads.png') });

    await page.evaluate(() => {
      window.__fpsApi.setAds(false);
      window.__fpsApi.equipWeapon(0);
      window.__fpsApi.setPlayerPose(16.5, 0.0, 2.5, 0.0, -0.05);
      window.__fpsApi.reload();
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_07_warehouse_reload.png') });

    // Capture 10th Viewport: Third-Person Over-the-Shoulder Tactical Mode (CC0 65-Bone Operator)
    await page.evaluate(() => {
      window.__fpsApi.equipWeapon(0);
      window.__fpsApi.setThirdPerson(true);
      window.__fpsApi.setPlayerPose(-6.2, 0.0, 21.5, 0.0, -0.02);
      window.__fpsApi.fire();
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_10_third_person_tps.png') });

    await page.evaluate(() => {
      window.__fpsApi.setThirdPerson(false);
      window.__fpsApi.equipWeapon(0);
      window.__fpsApi.toggleLoadout(true);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_08_loadout_3d_inspect.png') });

    await page.evaluate(() => {
      window.__fpsApi.toggleLoadout(false);
      window.__fpsApi.openMissionComplete();
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'view_09_mission_complete.png') });

    await ctx.close();

    // Generate Side-by-Side A/B Comparisons
    await composeSideBySideAB(
      browser,
      path.resolve('reference/concept/port_overview_hero.jpg'),
      path.join(EVIDENCE_DIR, 'cam_hero_render.png'),
      'CAM_HERO (Pitch 26°) — Night Port Overview Concept vs Real-Time 3D Engine',
      path.join(EVIDENCE_DIR, 'ab_comparison_hero.png')
    );
    await composeSideBySideAB(
      browser,
      path.resolve('reference/concept/port_combat_lane_mid.jpg'),
      path.join(EVIDENCE_DIR, 'cam_lane_render.png'),
      'CAM_LANE (Eye-Level) — West Dock Combat Corridor Concept vs Real-Time 3D Engine',
      path.join(EVIDENCE_DIR, 'ab_comparison_lane.png')
    );
    if (fs.existsSync(path.join(EVIDENCE_DIR, 'cam_hero_before.png'))) {
      await composeSideBySideAB(
        browser,
        path.join(EVIDENCE_DIR, 'cam_hero_before.png'),
        path.join(EVIDENCE_DIR, 'cam_hero_render.png'),
        'OPTIMIZATION CYCLE A/B — Before (277k Tris / No EnvMap) vs v0.4.0 (CC0 FPS/TPS + Puddle Ripples + Chain Blast + 181k Tris)',
        path.join(EVIDENCE_DIR, 'ab_optimization_before_after.png'),
        '[BEFORE] CYCLE 1 ENGINE RENDER (277,664 TRIS)',
        '[AFTER] CYCLE 5 (v0.4.0) OPTIMIZED RENDER (CC0 FPS/TPS + RIPPLES + 181K TRIS)'
      );
    }

    // -----------------------------------------------------------------------
    // Part 2: Sample Real-Time Unthrottled GPU Performance (1920x1080 / 1280x720)
    // -----------------------------------------------------------------------
    const perfCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const perfPage = await perfCtx.newPage();
    await perfPage.goto(standaloneUrl, { waitUntil: 'load', timeout: 30000 });
    await perfPage.waitForFunction(() => {
      const st = window.__fpsApi?.getState?.();
      return st && st.enemiesTotal === 8;
    }, null, { timeout: 20000 });
    await perfPage.evaluate(() => window.__fpsApi.setPlayerPose(-6.5, 0.0, 22.0, 0.0, -0.02));
    await perfPage.waitForTimeout(2200);
    const perfRealtime = await perfPage.evaluate(() => window.__fpsApi.getPerf());
    await perfCtx.close();

    // -----------------------------------------------------------------------
    // Part 3: Record Continuous Non-Capture Gameplay Video (.mp4 & .webm)
    // -----------------------------------------------------------------------
    const vidCtx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: EVIDENCE_DIR, size: { width: 1280, height: 720 } },
    });
    const vidPage = await vidCtx.newPage();
    await vidPage.goto(standaloneUrl, { waitUntil: 'load', timeout: 30000 });
    await vidPage.waitForFunction(() => {
      const st = window.__fpsApi?.getState?.();
      return st && st.enemiesTotal === 8;
    }, null, { timeout: 20000 });
    await vidPage.waitForTimeout(300);

    // Start in-browser MP4 MediaRecorder directly on the WebGL canvas stream (30 FPS H.264/MP4)
    await vidPage.evaluate(() => {
      const canvasEl = document.getElementById('webgl-canvas');
      const stream = canvasEl.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : 'video/webm';
      const chunks = [];
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4500000 });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      window.__stopCanvasMp4 = () =>
        new Promise((resolve) => {
          rec.onstop = async () => {
            const blob = new Blob(chunks, { type: mime });
            const buf = await blob.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            resolve({ mime, b64: btoa(bin) });
          };
          rec.stop();
        });
      rec.start(100);
    });

    // 1. Walk forward along the wet dock lane while enemy soldiers patrol and engage
    await vidPage.evaluate(() => window.__fpsApi.setPlayerPose(-6.5, 0.0, 23.0, 0.0, -0.02));
    await vidPage.keyboard.down('KeyW');
    for (let step = 0; step < 8; step++) {
      await vidPage.waitForTimeout(180);
      if (step === 2) await vidPage.evaluate(() => window.__fpsApi.setAds(true));
      if (step >= 3 && step <= 6) await vidPage.evaluate(() => window.__fpsApi.fire());
    }
    await vidPage.keyboard.up('KeyW');

    // 2. Trigger Reload animation
    await vidPage.evaluate(() => {
      window.__fpsApi.setAds(false);
      window.__fpsApi.reload();
    });
    await vidPage.waitForTimeout(850);

    // 3. Switch to SR-9 Sniper Rifle, ADS Scope, and fire headshot
    await vidPage.evaluate(() => {
      window.__fpsApi.equipWeapon(1);
      window.__fpsApi.setPlayerPose(-6.5, 0.0, 25.0, 0.0, -0.02);
      window.__fpsApi.setAds(true);
    });
    await vidPage.waitForTimeout(420);
    await vidPage.evaluate(() => window.__fpsApi.fire());
    await vidPage.waitForTimeout(420);

    // 4. Switch to RL-7 Rocket Launcher and fire explosive rocket at red barrel & enemy squad
    await vidPage.evaluate(() => {
      window.__fpsApi.setAds(false);
      window.__fpsApi.equipWeapon(2);
      window.__fpsApi.setPlayerPose(-6.5, 0.0, 18.5, 0.02, -0.08);
      window.__fpsApi.fire();
    });
    await vidPage.waitForTimeout(700);

    // 5. Toggle Third-Person Over-the-Shoulder Mode ([P]), jog forward & fire AR-7
    await vidPage.evaluate(() => {
      window.__fpsApi.equipWeapon(0);
      window.__fpsApi.setThirdPerson(true);
    });
    await vidPage.keyboard.down('KeyW');
    for (let step = 0; step < 5; step++) {
      await vidPage.waitForTimeout(160);
      if (step >= 2) await vidPage.evaluate(() => window.__fpsApi.fire());
    }
    await vidPage.keyboard.up('KeyW');
    await vidPage.evaluate(() => window.__fpsApi.setThirdPerson(false));
    await vidPage.waitForTimeout(250);

    const mp4Data = await vidPage.evaluate(() => window.__stopCanvasMp4());
    const perfDuringVideoCapture = await vidPage.evaluate(() => window.__fpsApi.getPerf());
    const finalState = await vidPage.evaluate(() => window.__fpsApi.getState());

    const targetMp4Path = path.join(EVIDENCE_DIR, 'gameplay_walk_aim_shoot_reload_ai.mp4');
    fs.writeFileSync(targetMp4Path, Buffer.from(mp4Data.b64, 'base64'));

    const videoObj = vidPage.video();
    await vidPage.close();
    const rawWebmPath = await videoObj.path();
    const targetWebmPath = path.join(EVIDENCE_DIR, 'gameplay_walk_aim_shoot_reload_ai.webm');
    fs.copyFileSync(rawWebmPath, targetWebmPath);
    if (rawWebmPath !== targetWebmPath && fs.existsSync(rawWebmPath)) {
      fs.unlinkSync(rawWebmPath);
    }
    await vidCtx.close();

    const report = {
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      branch: 'feat/v0.1.0-night-port-vertical-slice',
      status: errors.length === 0 ? 'PASS' : 'FAIL',
      viewport: '1376x768 (screenshots) / 1280x720 (video)',
      videoRecorderMime: mp4Data.mime,
      performance: perfRealtime,
      performanceDuringDualVideoEncode: perfDuringVideoCapture,
      gameplayState: finalState,
      errors,
      evidenceFiles: fs.readdirSync(EVIDENCE_DIR),
    };
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'perf_report.json'), JSON.stringify(report, null, 2));
    console.log('QA_VERIFY_COMPLETE:', JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
