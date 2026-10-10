import { query } from '../db';

/**
 * Closed-report retention (pending Al's sign-off on the period).
 *
 *   REPORT_RETENTION_MONTHS              months after a report is closed
 *                                        (actioned / dismissed) before it is
 *                                        deleted. Default 12.
 *   REPORT_RETENTION_MONTHS_AFTER_CLOSE  accepted as an alias.
 *   REPORT_PURGE_ENABLED                 'true' to run the purge job. Off by
 *                                        default: nothing is deleted until set.
 *   REPORT_RETENTION_PURGE_ENABLED       accepted as an alias.
 *
 * Open, reviewing, and legal_hold reports are never purged.
 */
export const REPORT_RETENTION_DEFAULT_MONTHS = 12;

function firstEnv(env: NodeJS.ProcessEnv, keys: string[]): string {
  for (const key of keys) {
    const raw = (env[key] ?? '').trim();
    if (raw) return raw;
  }
  return '';
}

export function reportRetentionMonths(env: NodeJS.ProcessEnv = process.env): number {
  const raw = firstEnv(env, ['REPORT_RETENTION_MONTHS', 'REPORT_RETENTION_MONTHS_AFTER_CLOSE']);
  if (!raw) return REPORT_RETENTION_DEFAULT_MONTHS;
  const n = Number(raw);
  // Whole months, at least 1. Anything else falls back to the default rather
  // than risk purging too early.
  if (!Number.isInteger(n) || n < 1) return REPORT_RETENTION_DEFAULT_MONTHS;
  return n;
}

/** @deprecated Use reportRetentionMonths */
export const reportRetentionMonthsAfterClose = reportRetentionMonths;

export function reportPurgeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = firstEnv(env, ['REPORT_PURGE_ENABLED', 'REPORT_RETENTION_PURGE_ENABLED']);
  return raw.toLowerCase() === 'true' || raw === '1' || raw.toLowerCase() === 'yes';
}

/** @deprecated Use reportPurgeEnabled */
export const reportRetentionPurgeEnabled = reportPurgeEnabled;

export const reportRetentionService = {
  /**
   * Delete closed reports (and cascaded evidence) whose close date is more
   * than `months` ago. Skips legal_hold. Returns the number deleted.
   */
  async purgeClosedReports(months = reportRetentionMonths()): Promise<number> {
    const res = await query(
      `DELETE FROM reports
        WHERE status IN ('actioned', 'dismissed')
          AND legal_hold = FALSE
          AND COALESCE(closed_at, resolved_at) IS NOT NULL
          AND COALESCE(closed_at, resolved_at) < NOW() - make_interval(months => $1::int)`,
      [months],
    );
    return res.rowCount ?? 0;
  },

  /** No-op unless REPORT_PURGE_ENABLED (or the alias) is on. */
  async runScheduledPurge(env: NodeJS.ProcessEnv = process.env): Promise<number> {
    if (!reportPurgeEnabled(env)) return 0;
    return this.purgeClosedReports(reportRetentionMonths(env));
  },
};

let handle: NodeJS.Timeout | null = null;

/** Daily purge of closed reports. Does nothing unless REPORT_PURGE_ENABLED=true. */
export function startReportRetentionWorker() {
  if (handle || !reportPurgeEnabled()) return;
  const run = async () => {
    const months = reportRetentionMonths();
    const n = await reportRetentionService.runScheduledPurge();
    if (n) console.log(`[report-retention] purged ${n} closed report(s) older than ${months} months`);
  };
  void run().catch(() => {
    console.error('[report-retention] initial purge failed');
  });
  handle = setInterval(() => {
    void run().catch(() => {
      console.error('[report-retention] purge failed');
    });
  }, 24 * 60 * 60 * 1000);
  handle.unref?.();
}
