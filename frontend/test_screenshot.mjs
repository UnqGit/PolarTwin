import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173/Maitri/connections', { waitUntil: 'networkidle2' });
  
  // Wait a bit for layout to finish and SVG to render
  await new Promise(r => setTimeout(r, 6000));
  
  await page.screenshot({ path: 'elk_screenshot.png' });
  await browser.close();
})();
