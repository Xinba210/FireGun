import { chromium } from 'playwright';
import path from 'path';

async function run() {
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

  const page = await mobileContext.newPage();
  console.log('Navigating to combat...');
  await page.goto('http://localhost:5199/?qa=1&cam=entry', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#hud', { timeout: 120000 });
  await page.waitForTimeout(1000);

  // Open tactical drawer
  console.log('Opening drawer and clicking 3D Gunsmith button...');
  await page.click('#touch-btn-drawer', { force: true });
  await page.waitForSelector('#touch-btn-loadout', { timeout: 5000 });
  await page.click('#touch-btn-loadout', { force: true });

  // Wait for Gunsmith workbench modal
  await page.waitForSelector('#loadout-modal:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(800);

  const outPath = path.resolve('docs/evidence/v1.8.3/04_mobile_gunsmith_responsive.png');
  await page.screenshot({ path: outPath, timeout: 60000 });
  console.log('Successfully captured 04_mobile_gunsmith_responsive.png at:', outPath);

  await browser.close();
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
