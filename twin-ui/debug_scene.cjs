const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: 'new' 
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:5173');
  console.log("Navigated to app");
  
  const delay = ms => new Promise(res => setTimeout(res, ms));
  await delay(5000); // let scene load
  
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
  });
  
  await delay(2000);
  
  // Now change to new_station
  await page.select('#twin-select', 'new_station');
  await delay(3000);
  
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
  });
  
  await delay(2000);

  await browser.close();
})();
