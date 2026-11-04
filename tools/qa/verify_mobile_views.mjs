import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('docs/evidence/v1.8.3');
fs.mkdirSync(outDir, { recursive: true });

async function run() {
  console.log('=== QA: Mobile iPhone 14 Pro Portrait Verification ===');
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

  // Single-flow In-Combat First-Person, Tactical Drawer, and 3D Gunsmith Check
  console.log('Testing Mobile In-Combat First-Person, Drawer & Gunsmith...');
  const pageCombat = await mobileContext.newPage();
  await pageCombat.goto('http://localhost:5199/?qa=1&cam=entry', { waitUntil: 'domcontentloaded' });
  await pageCombat.waitForSelector('#hud', { timeout: 120000 });
  await pageCombat.waitForTimeout(1500);

  // Capture First-Person with hands, AR-7, and mid-right utility icons
  await pageCombat.screenshot({ path: path.join(outDir, '05_mobile_combat_first_person.png'), timeout: 60000 });
  console.log('Successfully captured 05_mobile_combat_first_person.png');

  // Tap tactical drawer (...) button
  console.log('Tapping tactical drawer (...) button...');
  await pageCombat.click('#touch-btn-drawer', { force: true });
  await pageCombat.waitForSelector('#touch-tactical-drawer:not(.hidden)', { timeout: 8000 });
  await pageCombat.waitForTimeout(500);
  await pageCombat.screenshot({ path: path.join(outDir, '06_mobile_tactical_drawer_expanded.png'), timeout: 60000 });
  console.log('Successfully captured 06_mobile_tactical_drawer_expanded.png');

  // Click 3D Gunsmith from tactical drawer
  console.log('Clicking 3D Gunsmith from drawer...');
  await pageCombat.click('#touch-btn-loadout', { force: true });
  await pageCombat.waitForSelector('#loadout-modal:not(.hidden)', { timeout: 10000 });
  await pageCombat.waitForTimeout(800);
  await pageCombat.screenshot({ path: path.join(outDir, '04_mobile_gunsmith_responsive.png'), timeout: 60000 });
  console.log('Successfully captured real 04_mobile_gunsmith_responsive.png');

  await pageCombat.close();

  await browser.close();
  console.log('=== All Mobile Evidence Successfully Captured! ===');
}

run().catch((err) => {
  console.error('QA script failed:', err);
  process.exit(1);
});
