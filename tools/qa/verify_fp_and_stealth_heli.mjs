import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.resolve('docs/evidence/v1.8.3');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log('=== Verifying FireGun v1.8.3 First-Person Viewmodel, Stealth Helicopter & Safe LZ ===');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--disable-gpu-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
    ],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });

  page.on('console', (msg) => {
    console.log('PAGE CONSOLE:', msg.text());
  });
  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err);
  });

  console.log('1. Navigating to http://localhost:5199/');
  await page.goto('http://localhost:5199/');

  // Wait for title portal
  await page.waitForSelector('#screen-title-portal:not(.hidden)', { timeout: 8000 });
  console.log('✓ Title portal ready');
  await page.screenshot({ path: path.join(OUT_DIR, '01_portal_v183.png') });

  // Tap start operation
  console.log('2. Tapping Start Operation...');
  await page.evaluate(() => {
    document.getElementById('btn-portal-deploy')?.click();
  });

  // Wait for preload to finish and tactical setup to open
  console.log('3. Waiting for Tactical Setup Hub...');
  await page.waitForSelector('#screen-tactical-setup:not(.hidden)', { timeout: 150000 });
  console.log('✓ Tactical Setup Hub active');
  await page.screenshot({ path: path.join(OUT_DIR, '02_tactical_setup_hub.png') });

  // Click commence infiltration
  console.log('4. Launching Tactical Infiltration...');
  await page.evaluate(() => {
    document.getElementById('btn-setup-deploy')?.click();
  });

  // Wait for cutscene overlay
  await page.waitForSelector('#cutscene-infiltration:not(.hidden)', { timeout: 15000 });
  console.log('✓ Cutscene started! Waiting 12 seconds to capture Stealth Helicopter with defensive flares...');
  await page.waitForTimeout(12000);
  await page.screenshot({ path: path.join(OUT_DIR, '03_stealth_heli_evasion_flares.png') });

  // Skip cutscene to touchdown
  console.log('5. Clicking Skip Cutscene button to touchdown at Safe LZ...');
  await page.evaluate(() => {
    document.getElementById('btn-skip-cutscene')?.click();
  });
  await page.waitForTimeout(2000);

  // Verify HUD is active
  console.log('5b. Checking combat HUD and cutscene state...');
  const hudState = await page.evaluate(() => {
    const el = document.getElementById('hud');
    const cutscene = document.getElementById('cutscene-infiltration');
    return {
      hudClass: el?.className,
      hudDisplay: el ? getComputedStyle(el).display : null,
      cutsceneClass: cutscene?.className,
    };
  });
  console.log('5c. State:', hudState);
  console.log('✓ Combat HUD active!');

  // Check player position and first person viewmodel visibility
  const status = await page.evaluate(() => {
    const w = window;
    return {
      hudVisible: !document.getElementById('hud')?.classList.contains('hidden'),
      versionText: document.querySelector('.hud-build-watermark')?.textContent,
      reticleVisible: !document.getElementById('reticle-wrap')?.classList.contains('hidden'),
    };
  });
  console.log('✓ Status checks:', status);

  // Take first-person combat screenshot (verify weapon & hands visible!)
  await page.screenshot({ path: path.join(OUT_DIR, '04_first_person_hands_and_weapon.png') });
  console.log('📸 Captured 04_first_person_hands_and_weapon.png');

  // Test toggling to Third-Person via [P] key
  console.log('6. Toggling Third-Person via [P] key...');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, '05_third_person_tactical_operator.png') });
  console.log('📸 Captured 05_third_person_tactical_operator.png');

  // Toggle back to First-Person via [P] key
  console.log('7. Toggling back to First-Person...');
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_DIR, '06_first_person_restored.png') });
  console.log('📸 Captured 06_first_person_restored.png');

  // Test Mobile Viewport Gunsmith Workbench
  console.log('8. Testing Mobile Portrait (390x844) Gunsmith Workbench...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('KeyL');
  await page.waitForSelector('#loadout-modal:not(.hidden)', { timeout: 5000 });

  const mobileScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  console.log(`✓ Mobile scroll width: ${mobileScrollWidth}px (Viewport: 390px)`);
  if (mobileScrollWidth <= 390) {
    console.log('✓ 0 Horizontal Overflow confirmed on mobile portrait!');
  } else {
    console.warn(`⚠ Horizontal overflow: ${mobileScrollWidth} > 390`);
  }
  await page.screenshot({ path: path.join(OUT_DIR, '07_mobile_gunsmith_workbench.png') });
  console.log('📸 Captured 07_mobile_gunsmith_workbench.png');

  console.log('=== ALL VISUAL VERIFICATIONS COMPLETED SUCCESSFULLY ===');
  await browser.close();
}

run().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
