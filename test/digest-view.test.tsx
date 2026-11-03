import { describe, expect, it } from 'vitest';
import type { DigestRow, Night } from '../src/digest/types.js';
import { Digest } from '../src/views/digest.js';

const row = (over: Partial<DigestRow>): DigestRow => ({
  job: 'a/job',
  owner: 'rook',
  runs: 1,
  retries: 0,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-10-28T23:00:02+01:00',
  lastAt: '2026-10-28T23:00:02+01:00',
  ...over,
});

const render = (night: Night) => String(<Digest night={night} />);

describe('digest view', () => {
  it('marks heavy retries and failures, and renders missing data as a dash', () => {
    const html = render({
      night: '2026-10-28',
      badLines: 1,
      rows: [
        row({ job: 'calm' }),
        row({ job: 'flaky', retries: 3, owner: null }),
        row({ job: 'broken', lastStatus: 'fail', lastError: 'boom' }),
      ],
    });
    expect(html).toContain('digest · 2026-10-28');
    expect(html.match(/<tr class="warn">/g)).toHaveLength(2);
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('boom');
    expect(html).toContain('1 line did not parse');
  });

  it('says nothing ran for an empty night', () => {
    const html = render({ night: '2026-10-28', rows: [], badLines: 0 });
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });
});
