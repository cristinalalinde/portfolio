import { createServer } from 'node:http';
import { readFile, stat, mkdir, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };

export function createApp({ dataDirectory = path.join(fileURLToPath(new URL('.', import.meta.url)), 'data') } = {}) {
  return createServer(async (req, res) => {
    const json = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/contact') {
        if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' });
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return json(403, { error: 'Invalid request origin.' });
        if (!req.headers['content-type']?.includes('application/json')) return json(415, { error: 'Expected JSON.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 16000) return json(413, { error: 'Your message is too long.' });
        }
        let fields;
        try { fields = JSON.parse(body); } catch { return json(400, { error: 'Invalid form data.' }); }
        if (!fields || typeof fields !== 'object') return json(400, { error: 'Invalid form data.' });
        const { email, subject, message } = fields;
        if (![email, subject, message].every(v => typeof v === 'string')) return json(400, { error: 'Invalid form data.' });
        if (![email, subject, message].some(v => v.trim())) return json(400, { error: 'Please complete at least one field.' });
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Please enter a valid email address.' });
        if (email.length > 254 || subject.length > 500 || message.length > 10000) return json(400, { error: 'Your message is too long.' });
        const submission = { id: randomUUID(), createdAt: new Date().toISOString(), email: email.trim(), subject: subject.trim(), message: message.trim() };
        await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
        await appendFile(path.join(dataDirectory, 'messages.jsonl'), JSON.stringify(submission) + '\n', { mode: 0o600 });
        return json(201, { success: true });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return json(400, { error: 'Invalid path.' }); }
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) return json(403, { error: 'Forbidden.' });
      const info = await stat(file);
      if (!info.isFile()) return json(404, { error: 'Not found.' });
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : await readFile(file));
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return json(404, { error: 'Not found.' });
      console.error('Request failed:', error.message);
      if (!res.headersSent) json(500, { error: 'Unable to process your request. Please try again.' });
      else res.end();
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const app = createApp();
  app.listen(port, host, () => console.log(`Cristina Lalinde portfolio is running at http://${host}:${port}`));
  app.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
