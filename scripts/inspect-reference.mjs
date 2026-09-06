import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('reference', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const resources = new Map();
const pending = [];
page.on('response', response => {
  const type = response.request().resourceType();
  if (['stylesheet', 'font', 'image'].includes(type) && response.ok()) {
    pending.push((async () => {
      try { resources.set(response.url(), { type, body: await response.body(), contentType: response.headers()['content-type'] }); } catch {}
    })());
  }
});
await page.goto('https://www.cristinalalinde.com/', { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(async () => {
  await document.fonts.ready;
  for (let y = 0; y < document.body.scrollHeight; y += 700) {
    window.scrollTo(0, y);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1000);
await page.screenshot({ path: 'reference/desktop.png', fullPage: true });
await writeFile('reference/rendered.html', await page.content());
const inspect = () => [...document.querySelectorAll('#header, .site-title, .site-tagline, #page, .sqs-html-content, .image-block, .Marquee, form, input, textarea, button, hr')].map(e => {
  const s = getComputedStyle(e); const r = e.getBoundingClientRect();
  return { tag: e.tagName, class: e.className, text: e.innerText?.slice(0, 160), rect: { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }, style: Object.fromEntries(['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color','backgroundColor','padding','margin','border','display'].map(k => [k,s[k]])) };
});
await writeFile('reference/desktop.json', JSON.stringify(await page.evaluate(inspect), null, 2));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1000);
await page.screenshot({ path: 'reference/mobile.png', fullPage: true });
await writeFile('reference/mobile.json', JSON.stringify(await page.evaluate(inspect), null, 2));
await writeFile('reference/mobile-rendered.html', await page.content());
await Promise.all(pending);
const manifest = [];
let i = 0;
for (const [url, resource] of resources) {
  const ext = resource.type === 'stylesheet' ? '.css' : resource.type === 'font' ? (url.includes('woff2') ? '.woff2' : '.woff') : resource.contentType?.includes('gif') ? '.gif' : resource.contentType?.includes('png') ? '.png' : resource.contentType?.includes('svg') ? '.svg' : resource.contentType?.includes('icon') ? '.ico' : '.jpg';
  const path = `/assets/reference-${++i}${ext}`;
  await writeFile(`public${path}`, resource.body);
  manifest.push({ url, path, type: resource.type });
}
await writeFile('reference/resources.json', JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ resources: manifest.length, title: await page.title(), links: await page.locator('a').evaluateAll(els => els.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') }))) }, null, 2));
await browser.close();
