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
  console.log('Navigating to portal...');
  await page.goto('http://localhost:5199/?qa=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-title-portal:not(.hidden)', { timeout: 15000 });

  console.log('Displaying centered preload screen explicitly...');
  await page.evaluate(() => {
    const el = document.getElementById('screen-preload');
    if (el) {
      el.classList.remove('hidden');
      el.style.opacity = '1';
    }
    const fill = document.getElementById('preload-line-fill');
    if (fill) fill.style.width = '68%';
    const pct = document.getElementById('preload-stage-pct');
    if (pct) pct.textContent = '68%';
    const lbl = document.getElementById('preload-stage-label');
    if (lbl) lbl.textContent = '[v1.8.3] STEP 4/7 · BUILDING REAL-TIME TACTICAL SCENE MESHES';
  });
  await page.waitForTimeout(400);

  const outPath = path.resolve('docs/evidence/v1.8.3/02_preload_centered_bar.png');
  await page.screenshot({ path: outPath, timeout: 60000 });
  console.log('Successfully captured 02_preload_centered_bar.png at:', outPath);

  await browser.close();
}

run().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
