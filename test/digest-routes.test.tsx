import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow, Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  const write = (night: string, lines: string[]) =>
    writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n') + '\n');

  write('2026-01-01', [
    line('2026-01-01T23:00:06+01:00', 'lane/sync', 'retry'),
    line('2026-01-01T23:00:02+01:00', 'a/first', 'ok'),
    line('2026-01-01T23:05:00+01:00', 'lane/sync', 'ok'),
  ]);
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
  write('2026-01-03', [
    line('2026-01-03T23:00:02+01:00', 'b/job', 'ok'),
    'this is not json',
    line('2026-01-03T23:00:09+01:00', 'a/job', 'fail'),
  ]);

  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

describe('GET /digest/:night', () => {
  it('renders a night with data', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-01-01');
    expect(html).toContain('lane/sync');
    expect(html).toContain('a/first');
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-02-02');
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line', async () => {
    const res = await app.request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line did not parse');
    expect(html).toContain('a/job');
    expect(html).toContain('b/job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['a/first', 'lane/sync']);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '2026-02-02' });
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts the bad line and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: DigestRow) => r.job)).toEqual(['a/job', 'b/job']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const night = '2026-01-01';
    const html = await (await app.request(`/digest/${night}`)).text();
    const body = (await (await app.request(`/api/digest/${night}`)).json()) as Night;
    const pageJobs = [...html.matchAll(/<tr[^>]*><td>([^<]+)<\/td>/g)].map((m) => m[1]);
    expect(pageJobs).toEqual(body.rows.map((r) => r.job));
    expect(pageJobs).toHaveLength(2);
  });
});
