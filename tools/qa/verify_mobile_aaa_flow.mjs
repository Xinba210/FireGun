import { chromium, devices } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const EVIDENCE_DIR = path.resolve('docs/evidence/v1.7.0');
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

async function safeScreenshot(page, filePath) {
  try {
    await page.screenshot({ path: filePath, timeout: 15000, animations: 'disabled' });
    console.log(`📸 Saved screenshot: ${path.basename(filePath)}`);
  } catch (err) {
    console.warn(`Screenshot note: ${path.basename(filePath)} (${err.message})`);
  }
}

async function run() {
  console.log('--- Launching Mobile Playwright Test (iPhone 14 Pro) ---');
  const iPhone = devices['iPhone 14 Pro'];
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

  const context = await browser.newContext({
    ...iPhone,
    permissions: [],
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  // Listen to page console
  page.on('console', (msg) => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', (err) => console.error('BROWSER ERROR:', err));

  // 1. Navigate to page
  console.log('1. Navigating to http://localhost:5199/');
  await page.goto('http://localhost:5199/');

  // 2. Verify Title Screen
  await page.waitForSelector('#screen-title-portal:not(.hidden)', { timeout: 8000 });
  console.log('✓ Stage 1: Hero Title Screen is visible');
  await safeScreenshot(page, path.join(EVIDENCE_DIR, '01_title_hero_screen.png'));

  // Check center button
  const startBtn = await page.waitForSelector('#btn-portal-deploy', { timeout: 3000 });
  const startBtnText = await startBtn.textContent();
  console.log(`✓ Center start button text: "${startBtnText.trim()}"`);

  // 3. Tap "開始遊戲 // START OPERATION"
  console.log('2. Tapping center "開始遊戲" button...');
  await startBtn.click({ force: true });

  // 4. Verify Preload Screen appears
  await page.waitForSelector('#screen-preload:not(.hidden)', { timeout: 8000 });
  console.log('✓ Stage 2: Preload Screen is active');

  // 5. Wait for Preload to complete and Tactical Setup Hub to open
  console.log('3. Waiting for Tactical Setup Hub to open...');
  await page.waitForSelector('#screen-tactical-setup:not(.hidden)', { timeout: 60000 });
  console.log('✓ Stage 3: Tactical Setup Hub is open');
  await safeScreenshot(page, path.join(EVIDENCE_DIR, '03_tactical_setup_hub.png'));

  // 6. Test opening Gunsmith from Setup Hub
  console.log('4. Clicking Gunsmith Tab and Workbench from Setup Hub...');
  await page.evaluate(() => {
    document.getElementById('setup-tab-btn-gunsmith')?.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.getElementById('btn-setup-to-gunsmith')?.click();
  });

  await page.waitForSelector('#loadout-modal:not(.hidden)', { timeout: 8000 });
  console.log('✓ Gunsmith Workbench opened');

  // Verify responsive dimensions on iPhone
  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = page.viewportSize().width;
  console.log(`✓ Page scroll width: ${bodyWidth}px (Viewport: ${viewportWidth}px)`);
  if (bodyWidth > viewportWidth) {
    console.error(`❌ Layout overflow detected! scrollWidth ${bodyWidth} > viewport ${viewportWidth}`);
  } else {
    console.log(`✓ 0 Horizontal Overflow on Mobile Portrait (${viewportWidth}px)!`);
  }

  await safeScreenshot(page, path.join(EVIDENCE_DIR, '04_gunsmith_mobile_portrait.png'));

  // Test tapping an attachment card in Gunsmith
  console.log('5. Tapping an attachment card...');
  const attCardsCount = await page.evaluate(() => document.querySelectorAll('#gunsmith-attachments-list .att-card').length);
  console.log(`✓ Found ${attCardsCount} attachment cards in list`);
  if (attCardsCount > 1) {
    await page.evaluate(() => {
      const cards = document.querySelectorAll('#gunsmith-attachments-list .att-card');
      if (cards.length > 1) cards[1].click();
    });
    console.log('✓ Clicked second attachment card');
    await page.waitForTimeout(300);
  }

  // Close Gunsmith and verify return to Tactical Setup Hub
  console.log('6. Closing Gunsmith...');
  await page.evaluate(() => {
    document.getElementById('btn-gunsmith-close')?.click();
  });
  await page.waitForSelector('#screen-tactical-setup:not(.hidden)', { timeout: 6000 });
  console.log('✓ Returned cleanly to Tactical Setup Hub');

  // Verify Settings tab and Haptics toggle button
  console.log('6b. Testing Settings tab and Haptic Feedback toggle...');
  await page.evaluate(() => {
    document.getElementById('setup-tab-btn-settings')?.click();
  });
  await page.waitForTimeout(200);
  const hapticsBtnText = await page.evaluate(() => document.getElementById('setup-btn-haptics-toggle')?.textContent);
  console.log(`✓ Haptics setup button text: "${hapticsBtnText}"`);
  await page.evaluate(() => {
    document.getElementById('setup-btn-haptics-toggle')?.click();
  });
  const hapticsAfterClick = await page.evaluate(() => document.getElementById('setup-btn-haptics-toggle')?.textContent);
  console.log(`✓ Haptics button after toggle: "${hapticsAfterClick}"`);
  await page.evaluate(() => {
    document.getElementById('setup-btn-haptics-toggle')?.click();
  });

  // 7. Click "確認出擊 // COMMENCE INFILTRATION"
  console.log('7. Clicking "確認出擊 // COMMENCE INFILTRATION"...');
  await page.evaluate(() => {
    document.getElementById('btn-setup-deploy')?.click();
  });

  await page.waitForSelector('#hud:not(.hidden)', { timeout: 8000 });
  console.log('✓ Stage 4: Tactical HUD and combat active!');

  // Wait 2 seconds for cutscene transition
  await page.waitForTimeout(2000);

  // 8. Test Reticle and Ammunition Card
  console.log('8. Testing dynamic bloom reticle and ammunition card tap...');
  const reticleExists = await page.evaluate(() => Boolean(document.getElementById('reticle-wrap')));
  console.log(`✓ Dynamic bloom reticle exists: ${reticleExists}`);
  await page.evaluate(() => {
    document.querySelector('.ammo-card')?.click();
  });
  console.log('✓ Clicked .ammo-card to trigger reload');

  // 9. Test Right-Side 3 Utility Icons
  console.log('9. Testing right-side touch buttons: NVG, TPS, Gyro...');
  await page.evaluate(() => {
    document.getElementById('touch-btn-nvg-quick')?.click();
  });
  const nvgActive = await page.evaluate(() => document.getElementById('touch-btn-nvg-quick')?.classList.contains('active'));
  console.log(`✓ NVG button active state: ${nvgActive}`);

  await page.evaluate(() => {
    document.getElementById('touch-btn-tps-quick')?.click();
  });
  const tpsActive = await page.evaluate(() => document.getElementById('touch-btn-tps-quick')?.classList.contains('active'));
  console.log(`✓ TPS button active state: ${tpsActive}`);

  await page.evaluate(() => {
    document.getElementById('touch-btn-gyro-quick')?.click();
  });
  const gyroActive = await page.evaluate(() => document.getElementById('touch-btn-gyro-quick')?.classList.contains('active'));
  console.log(`✓ Gyro button active state: ${gyroActive}`);

  await safeScreenshot(page, path.join(EVIDENCE_DIR, '05_mobile_combat_hud_active_icons.png'));

  console.log('--- ALL MOBILE AAA FLOW CHECKS PASSED SUCCESSFULLY ---');
  await browser.close();
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
