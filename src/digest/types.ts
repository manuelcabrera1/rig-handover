export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's night, folded from every line of `runs/<night>.jsonl` that names it. */
export type DigestRow = {
  job: string;
  /** `null` when the log has no owner; views render it as `—`. */
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  /** Error of the job's last line, `null` when that line has none. */
  lastError: string | null;
  /** `at` exactly as logged, offset kept. */
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  /** Sorted by job. */
  rows: DigestRow[];
  /** Lines that did not parse as a run line; counted, never thrown. */
  badLines: number;
};

/** Returns `null` when `runs/<night>.jsonl` does not exist. */
export type ReadNight = (runsDir: string, night: string) => Night | null;
