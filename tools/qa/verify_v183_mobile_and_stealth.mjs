import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('docs/evidence/v1.8.3');
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('--- Launching Headless Chromium for v1.8.3 QA ---');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--no-sandbox']
  });

  // 1. Mobile iPhone 14 Pro Portrait Viewport (390 x 844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2
  });
  const mobilePage = await mobileContext.newPage();

  console.log('Step 1: Navigating to Portal on Mobile...');
  await mobilePage.goto('http://localhost:5199/?qa=1', { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForSelector('#screen-title-portal:not(.hidden)', { timeout: 15000 });
  await mobilePage.screenshot({ path: path.join(outDir, '01_mobile_portal_v183.png') });
  console.log('Captured 01_mobile_portal_v183.png');

  // Trigger Start Operation to observe centered preload screen
  await mobilePage.click('#btn-portal-deploy', { force: true });
  console.log('Clicked Start Operation, waiting for Preload screen...');
  await mobilePage.waitForSelector('#screen-preload:not(.hidden)', { timeout: 15000 });
  await mobilePage.screenshot({ path: path.join(outDir, '02_preload_centered_bar.png') });
  console.log('Captured 02_preload_centered_bar.png');

  // Wait for Tactical Setup Hub
  console.log('Waiting for Tactical Setup Hub...');
  await mobilePage.waitForSelector('#screen-tactical-setup:not(.hidden)', { timeout: 150000 });
  await mobilePage.screenshot({ path: path.join(outDir, '03_mobile_tactical_setup.png') });
  console.log('Captured 03_mobile_tactical_setup.png');

  // Open 3D Gunsmith Workbench on mobile to verify responsive 0-overflow layout
  await mobilePage.click('#setup-tab-btn-gunsmith', { force: true });
  await mobilePage.waitForTimeout(400);
  await mobilePage.click('#btn-setup-to-gunsmith', { force: true });
  await mobilePage.waitForSelector('#loadout-modal:not(.hidden)', { timeout: 15000 });
  await mobilePage.screenshot({ path: path.join(outDir, '04_mobile_gunsmith_responsive.png') });
  console.log('Captured 04_mobile_gunsmith_responsive.png');

  // Close Gunsmith, return to Setup, and Deploy into Night Port combat
  await mobilePage.click('#btn-gunsmith-close', { force: true });
  await mobilePage.waitForSelector('#screen-tactical-setup:not(.hidden)', { timeout: 10000 });
  await mobilePage.click('#btn-setup-deploy', { force: true });
  console.log('Deploying into Infiltration LZ...');

  // Wait for Infiltration to complete (or skip)
  await mobilePage.waitForTimeout(2000);
  await mobilePage.keyboard.press('Space'); // skip cutscene directly into combat
  await mobilePage.waitForTimeout(1500);

  // Capture First-Person View with hands and weapon at Western Berm LZ
  await mobilePage.screenshot({ path: path.join(outDir, '05_mobile_combat_first_person.png') });
  console.log('Captured 05_mobile_combat_first_person.png');

  // Tap tactical drawer button (...) to verify collapsible menu expands smoothly
  await mobilePage.click('#touch-btn-drawer', { force: true });
  await mobilePage.waitForSelector('#touch-tactical-drawer:not(.hidden)', { timeout: 8000 });
  await mobilePage.screenshot({ path: path.join(outDir, '06_mobile_tactical_drawer_expanded.png') });
  console.log('Captured 06_mobile_tactical_drawer_expanded.png');

  await browser.close();
  console.log('=== All v1.8.3 Verification Screenshots Successfully Captured! ===');
}

run().catch((err) => {
  console.error('QA script encountered error:', err);
  process.exit(1);
});
