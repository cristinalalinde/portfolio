import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

const app = createApp();
await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  await mkdir('test-results', { recursive: true });
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const captures = [];
    for (const [source, url] of [['original', 'https://www.cristinalalinde.com/'], ['local', `http://127.0.0.1:${app.address().port}`]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      const contact = page.locator('.sqs-col-4').filter({ has: page.locator('form') });
      await contact.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const box = await contact.boundingBox();
      const measurements = await contact.locator('h2, label, input[type="email"], input[type="text"]:not([tabindex="-1"]), textarea, button').evaluateAll(elements => elements.map(e => {
        const style = getComputedStyle(e), box = e.getBoundingClientRect();
        return { tag: e.tagName, width: box.width, height: box.height, font: style.fontFamily, size: style.fontSize, color: style.color, background: style.backgroundColor, border: style.border, padding: style.padding };
      }));
      const screenshot = await contact.screenshot({ path: `test-results/contact-${name}-${source}.png` });
      captures.push({ source, width: box.width, height: box.height, measurements, screenshot });
      await page.close();
    }
    assert.deepEqual(captures[0].measurements, captures[1].measurements, `${name}: contact typography, dimensions, colors, borders, and padding match`);
    assert.equal(captures[0].height, captures[1].height);
    assert.equal(captures[0].width, captures[1].width);
    results.push({ viewport: name, measurementsMatch: true, screenshotBytesMatch: captures[0].screenshot.equals(captures[1].screenshot), captures: captures.map(({ screenshot, ...capture }) => ({ ...capture, screenshotSha256: createHash('sha256').update(screenshot).digest('hex') })) });
  }
  await writeFile('test-results/contact-comparison.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({ captures, ...result }) => result), null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => app.close(resolve));
}
