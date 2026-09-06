// Converts the captured, rendered page into a standalone document.
// Run inspect-reference.mjs first if you intentionally want to refresh the source.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const resources = JSON.parse(await readFile('reference/resources.json', 'utf8'));
const source = await readFile('reference/rendered.html', 'utf8');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const html = await page.evaluate(({ source, resources }) => {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const exact = new Map(resources.map(r => [r.url, r.path]));
  const images = new Map(resources.filter(r => r.type === 'image').map(r => [r.url.split('?')[0], r.path]));
  doc.querySelectorAll('script, base, link[rel="preconnect"], link[rel="dns-prefetch"], link[rel="preload"], link[rel="canonical"], meta[http-equiv="Accept-CH"]').forEach(e => e.remove());
  for (const link of doc.querySelectorAll('link[href]')) {
    const local = exact.get(new URL(link.getAttribute('href'), 'https://www.cristinalalinde.com').href);
    if (local) link.setAttribute('href', local);
    else if (link.rel === 'icon') link.setAttribute('href', '/assets/favicon.ico');
    else link.remove();
  }
  for (const img of doc.querySelectorAll('img')) {
    const original = img.getAttribute('data-src') || img.getAttribute('src');
    img.src = images.get(original.split('?')[0]);
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.classList.add('loaded');
    const caption = img.closest('.image-block')?.querySelector('.image-title')?.textContent?.trim();
    img.alt = caption || `Email design portfolio ${original.match(/Portfolio\+(\d+)/)?.[1] || ''}`;
    img.decoding = 'async';
  }
  for (const e of doc.querySelectorAll('*')) {
    for (const a of [...e.attributes]) {
      if (a.name.startsWith('on') || ['data-block-scripts', 'data-block-css', 'data-controller', 'data-controllers-bound', 'data-src', 'data-image'].includes(a.name)) e.removeAttribute(a.name);
    }
  }
  const form = doc.querySelector('form');
  form.id = 'contact-form';
  form.removeAttribute('novalidate');
  form.action = '/api/contact';
  form.method = 'post';
  const fields = form.querySelectorAll('.field-list > .form-item');
  ['email', 'subject', 'message'].forEach((name, i) => {
    const input = fields[i].querySelector('input, textarea');
    input.name = name;
    input.maxLength = [254, 500, 10000][i];
    input.autocomplete = name === 'email' ? 'email' : 'off';
  });
  const honeypot = form.querySelector('#message-field');
  if (honeypot) honeypot.parentElement.remove();
  const status = doc.createElement('p');
  status.id = 'form-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;
  form.after(status);
  const toggle = doc.querySelector('.mobile-nav-toggle-label');
  toggle.setAttribute('role', 'button');
  toggle.setAttribute('tabindex', '0');
  toggle.setAttribute('aria-label', 'Toggle navigation');
  toggle.setAttribute('aria-expanded', 'false');
  doc.documentElement.lang = 'en';
  doc.documentElement.classList.remove('wf-loading');
  doc.querySelector('meta[name="description"]').content = 'Cristina Lalinde — graphic and email designer from Medellín, Colombia. Email design, branding, and marketing for clients around the globe.';
  const css = doc.createElement('link');
  css.rel = 'stylesheet'; css.href = '/app.css'; doc.body.append(css);
  const js = doc.createElement('script');
  js.src = '/app.js'; js.defer = true; doc.body.append(js);
  return '<!doctype html>\n' + doc.documentElement.outerHTML;
}, { source, resources });

function localizeCSS(text) {
  return text.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (whole, quote, url) => {
    if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('/assets/')) return whole;
    const normalized = url.startsWith('//') ? 'https:' + url : url;
    const resource = resources.find(r => r.url === normalized);
    return `url("${resource?.path || 'data:,'}")`;
  });
}
await writeFile('public/index.html', localizeCSS(html).replace(/<!--[^]*?-->/g, '').replace(/\n\s*\n/g, '\n'));
for (const resource of resources.filter(r => r.type === 'stylesheet')) {
  const file = `public${resource.path}`;
  await writeFile(file, localizeCSS(await readFile(file, 'utf8')));
}
await browser.close();
console.log('Standalone page created. All displayed images, fonts, and styles are local.');
