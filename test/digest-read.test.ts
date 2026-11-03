import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('folds the night into 5 jobs sorted by job, counting 1 bad line', () => {
    expect(night?.night).toBe('2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the last status and offsets as logged', () => {
    const sync = night?.rows.find((r) => r.job === 'lane/sync');
    expect(sync).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('keeps the error of the last line', () => {
    const backup = night?.rows.find((r) => r.job === 'notes/backup');
    expect(backup).toMatchObject({ runs: 1, retries: 0, lastStatus: 'fail', lastError: 'quota exceeded' });
    const refresh = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
  });

  it('keeps a job whose owner is null', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });
});

describe('readNight edge cases', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns an empty night for an empty file', () => {
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
  });

  it('keeps a null owner row and ignores blank lines', () => {
    writeFileSync(
      join(dir, '2026-01-01.jsonl'),
      '{"at":"2026-01-01T01:00:00-05:00","job":"a","status":"ok","owner":null}\n\n',
    );
    expect(readNight(dir, '2026-01-01')).toEqual({
      night: '2026-01-01',
      badLines: 0,
      rows: [
        {
          job: 'a',
          owner: null,
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          firstAt: '2026-01-01T01:00:00-05:00',
          lastAt: '2026-01-01T01:00:00-05:00',
        },
      ],
    });
  });

  it('counts lines with invalid fields as bad', () => {
    const lines = [
      '{"at":"2026-01-01T01:00:00Z","job":"a","status":"maybe","owner":null}',
      '{"at":"2026-01-01T01:00:00Z","status":"ok","owner":null}',
      '{"at":"2026-01-01T01:00:00Z","job":"a","status":"ok","owner":7}',
      '{"at":"2026-01-01T01:00:00Z","job":"a","status":"ok","owner":null,"error":42}',
      '[1,2]',
      'null',
    ];
    writeFileSync(join(dir, '2026-01-01.jsonl'), lines.join('\n'));
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 6 });
  });
});
