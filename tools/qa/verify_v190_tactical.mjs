import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function run() {
  const evidenceDir = path.resolve('docs/evidence/v1.9.0');
  fs.mkdirSync(evidenceDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2
  });

  // 1. Mobile Portal Hero
  const page1 = await mobileContext.newPage();
  console.log('[1/6] Capturing Mobile Portal Hero...');
  await page1.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
  await page1.waitForSelector('#screen-title-portal:not(.hidden)', { timeout: 30000 });
  await page1.waitForTimeout(600);
  await page1.screenshot({ path: path.join(evidenceDir, '01_mobile_portal_v190.png') });
  console.log('✓ Captured 01_mobile_portal_v190.png');

  // 2. Preload Screen (Centered Yellow Bar, 0-breaking CCTV header)
  console.log('[2/6] Capturing Centered Preload Screen...');
  await page1.evaluate(() => {
    const portal = document.getElementById('screen-title-portal');
    if (portal) portal.classList.add('hidden');
    const el = document.getElementById('screen-preload');
    if (el) {
      el.classList.remove('hidden');
      el.style.opacity = '1';
    }
    const fill = document.getElementById('preload-line-fill');
    if (fill) fill.style.width = '75%';
    const pct = document.getElementById('preload-stage-pct');
    if (pct) pct.textContent = '75%';
    const lbl = document.getElementById('preload-stage-label');
    if (lbl) lbl.textContent = '[v1.9.0] STEP 5/7 · PRE-SYNTHESIZING ZERO-VOLUME AUDIO BUFFERS';
  });
  await page1.waitForTimeout(400);
  await page1.screenshot({ path: path.join(evidenceDir, '02_preload_centered_v190.png') });
  console.log('✓ Captured 02_preload_centered_v190.png');

  // 3. Tactical Setup Screen (Mobile)
  console.log('[3/6] Capturing Tactical Setup Screen...');
  await page1.evaluate(() => {
    const el = document.getElementById('screen-preload');
    if (el) el.classList.add('hidden');
    const setup = document.getElementById('screen-tactical-setup');
    if (setup) setup.classList.remove('hidden');
  });
  await page1.waitForTimeout(500);
  await page1.screenshot({ path: path.join(evidenceDir, '03_mobile_tactical_setup_v190.png') });
  console.log('✓ Captured 03_mobile_tactical_setup_v190.png');

  // 4. Gunsmith Workbench (Mobile)
  console.log('[4/6] Capturing Gunsmith Workbench (Responsive Mobile)...');
  await page1.evaluate(() => {
    const setup = document.getElementById('screen-tactical-setup');
    if (setup) setup.classList.add('hidden');
    const loadout = document.getElementById('loadout-modal');
    if (loadout) loadout.classList.remove('hidden');
  });
  await page1.waitForTimeout(500);
  await page1.screenshot({ path: path.join(evidenceDir, '04_mobile_gunsmith_v190.png') });
  console.log('✓ Captured 04_mobile_gunsmith_v190.png');
  await page1.close();

  // 5. In-game Combat View on Mobile Context
  console.log('[5/6] Capturing Mobile Combat HUD...');
  const pageCombat = await mobileContext.newPage();
  await pageCombat.goto('http://localhost:5199/?qa=1&cam=entry', { waitUntil: 'domcontentloaded' });
  await pageCombat.waitForSelector('#hud', { timeout: 120000 });
  await pageCombat.waitForTimeout(2000);
  await pageCombat.screenshot({ path: path.join(evidenceDir, '05_mobile_combat_fp_v190.png') });
  console.log('✓ Captured 05_mobile_combat_fp_v190.png');
  await pageCombat.close();

  // 6. Desktop Context for High-Resolution Expanded Port Scene & Revolving Lighthouse
  console.log('[6/6] Capturing Desktop Expanded Port & Lighthouse...');
  const deskContext = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const deskPage = await deskContext.newPage();
  await deskPage.goto('http://localhost:5199/?qa=1&cam=entry', { waitUntil: 'domcontentloaded' });
  await deskPage.waitForSelector('#hud', { timeout: 120000 });
  await deskPage.waitForTimeout(2000);

  await deskPage.screenshot({ path: path.join(evidenceDir, '06_expanded_port_lighthouse_v190.png') });
  console.log('✓ Captured 06_expanded_port_lighthouse_v190.png');
  await deskPage.close();

  await browser.close();
  console.log('ALL 6 EVIDENCE SCREENSHOTS SUCCESSFULLY CAPTURED!');
}

run().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
