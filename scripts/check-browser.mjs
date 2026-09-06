import { chromium } from 'playwright';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';

const dataDirectory = await mkdtemp(path.join(tmpdir(), 'portfolio-browser-'));
const server = createApp({ dataDirectory });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  await mkdir('test-results', { recursive: true });
  const page = await browser.newPage();
  const errors = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', req => { if (!req.url().startsWith(url) && !req.url().startsWith('data:')) external.push(req.url()); });
  const report = [];
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['tablet', 768, 1024], ['wide', 1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('img').count(), 12);
    assert.equal(await page.locator('img').evaluateAll(imgs => imgs.filter(img => !img.complete || !img.naturalWidth).length), 0, 'All images loaded');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: no horizontal overflow`);
    const boxes = await page.locator('#header, .site-title, .site-tagline, #page, .sqs-html-content, .image-block, .Marquee, form, input, textarea, button, hr').evaluateAll(els => els.map(e => {
      const r = e.getBoundingClientRect();
      return { tag: e.tagName, class: e.className, rect: { x: r.x, y: r.y + scrollY, width: r.width, height: r.height } };
    }));
    if (['desktop', 'mobile'].includes(name)) {
      const reference = JSON.parse(await readFile(`reference/${name}.json`, 'utf8'));
      const comparisons = boxes.filter(e => ['MAIN', 'HR', 'FORM', 'BUTTON'].includes(e.tag) || e.class.includes('image-block') || e.class === 'sqs-html-content').map(e => {
        const candidates = reference.filter(r => r.tag === e.tag && r.class === e.class);
        const matching = candidates.sort((a, b) => Math.abs(a.rect.y - e.rect.y) + Math.abs(a.rect.x - e.rect.x) - Math.abs(b.rect.y - e.rect.y) - Math.abs(b.rect.x - e.rect.x))[0];
        return { tag: e.tag, class: e.class, actual: e.rect, expected: matching?.rect, maxDifference: matching ? Math.max(...Object.keys(e.rect).map(k => Math.abs(e.rect[k] - matching.rect[k]))) : null };
      });
      report.push({ viewport: name, comparisons });
      assert.ok(comparisons.every(c => c.maxDifference !== null && c.maxDifference <= 1), `${name}: layout matches the reference within one pixel`);
    }
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
  }
  const offset = await page.locator('textPath.Marquee-svg-text').first().getAttribute('startOffset');
  await page.waitForTimeout(200);
  assert.notEqual(await page.locator('textPath.Marquee-svg-text').first().getAttribute('startOffset'), offset, 'Headings animate');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pausedOffset = await page.locator('textPath.Marquee-svg-text').first().getAttribute('startOffset');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('textPath.Marquee-svg-text').first().getAttribute('startOffset'), pausedOffset, 'Reduced motion respected');
  await page.getByLabel('YOUR EMAIL', { exact: true }).fill('test@example.com');
  await page.getByLabel('SUBJECT', { exact: true }).fill('Local browser verification');
  await page.getByLabel('MESSAGE', { exact: true }).fill('This is an automated local form check.');
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Thank you!' }).waitFor();
  assert.equal(JSON.parse(await readFile(path.join(dataDirectory, 'messages.jsonl'), 'utf8')).email, 'test@example.com');
  assert.deepEqual(errors, [], 'No JavaScript errors');
  assert.deepEqual(external, [], 'No external network dependencies');
  await writeFile('test-results/layout-comparison.json', JSON.stringify(report, null, 2));
  console.log('PASS: desktop/mobile/tablet/wide layouts, 12 local images, animated headings, reduced motion, contact submission, no external requests, no JavaScript errors.');
  console.log(JSON.stringify(report.map(r => ({ viewport: r.viewport, differences: r.comparisons.filter(c => c.maxDifference > 1) })), null, 2));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await rm(dataDirectory, { recursive: true, force: true });
}
