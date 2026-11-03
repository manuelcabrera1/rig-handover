import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NightCounts = { ok: number; retry: number; fail: number };

function statusOf(line: string): keyof NightCounts | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const status = (parsed as { status?: unknown }).status;
    return status === 'ok' || status === 'retry' || status === 'fail' ? status : null;
  } catch {
    return null;
  }
}

/** Line counts by status; `null` when the night's file cannot be read. */
export function countNight(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split('\n')) {
    const status = statusOf(line);
    if (status) counts[status]++;
  }
  return counts;
}
