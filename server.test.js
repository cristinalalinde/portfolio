import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './server.js';

test('Node server serves the portfolio and persists validated contact submissions privately', async t => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'portfolio-test-'));
  const app = createApp({ dataDirectory });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => app.close(resolve));
    await rm(dataDirectory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.address().port}`;
  const post = (body, headers = {}) => fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  const home = await fetch(base);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /CRISTINA LALINDE/);
  const asset = await fetch(base + '/assets/reference-13.gif');
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get('content-type'), 'image/gif');
  assert.equal((await fetch(base + '/server.js')).status, 404);
  assert.equal((await fetch(base + '/data/messages.jsonl')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e%2fpackage.json')).status, 403);
  assert.equal((await fetch(base + '/api/contact')).status, 405);
  assert.equal((await post(null)).status, 400);
  assert.equal((await post({ email: '', subject: '', message: '' })).status, 400);
  assert.equal((await post({ email: 'invalid', subject: '', message: 'Hello' })).status, 400);
  assert.equal((await post({ email: 'test@example.com', subject: 'Hi', message: 'Hello' }, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await post({ email: 'test@example.com', subject: 'Hi', message: 'Hello' })).status, 201);
  const saved = JSON.parse(await readFile(path.join(dataDirectory, 'messages.jsonl'), 'utf8'));
  assert.equal(saved.email, 'test@example.com');
  assert.equal(saved.message, 'Hello');
  assert.ok(saved.id);
  assert.ok(saved.createdAt);
});
