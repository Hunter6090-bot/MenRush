import { query } from '../db';

/**
 * Closed-report retention (pending Al's sign-off on the period).
 *
 *   REPORT_RETENTION_MONTHS_AFTER_CLOSE  months after a report is closed
 *                                        (actioned / dismissed) before it is
 *                                        deleted. Default 12.
 *   REPORT_RETENTION_PURGE_ENABLED       'true' to run the purge job. Off by
 *                                        default: nothing is deleted until set.
 *
 * Open and reviewing reports are never purged, whatever their age.
 */
export const REPORT_RETENTION_DEFAULT_MONTHS = 12;

export function reportRetentionMonthsAfterClose(env: NodeJS.ProcessEnv = process.env): number {
  const raw = (env.REPORT_RETENTION_MONTHS_AFTER_CLOSE ?? '').trim();
  if (!raw) return REPORT_RETENTION_DEFAULT_MONTHS;
  const n = Number(raw);
  // Whole months, at least 1. Anything else falls back to the default rather
  // than risk purging too early.
  if (!Number.isInteger(n) || n < 1) return REPORT_RETENTION_DEFAULT_MONTHS;
  return n;
}

export function reportRetentionPurgeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.REPORT_RETENTION_PURGE_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export const reportRetentionService = {
  /**
   * Delete closed reports whose resolved_at is more than `months` ago.
   * Returns the number deleted. Callers decide whether the job is on.
   */
  async purgeClosedReports(months = reportRetentionMonthsAfterClose()): Promise<number> {
    const res = await query(
      `DELETE FROM reports
        WHERE status IN ('actioned', 'dismissed')
          AND resolved_at IS NOT NULL
          AND resolved_at < NOW() - make_interval(months => $1::int)`,
      [months],
    );
    return res.rowCount ?? 0;
  },
};

let handle: NodeJS.Timeout | null = null;

/** Daily purge of closed reports. Does nothing unless REPORT_RETENTION_PURGE_ENABLED=true. */
export function startReportRetentionWorker() {
  if (handle || !reportRetentionPurgeEnabled()) return;
  const run = async () => {
    const months = reportRetentionMonthsAfterClose();
    const n = await reportRetentionService.purgeClosedReports(months);
    if (n) console.log(`[report-retention] purged ${n} closed report(s) older than ${months} months`);
  };
  void run().catch((err) => console.error('[report-retention] initial purge failed:', err));
  handle = setInterval(() => {
    void run().catch((err) => console.error('[report-retention] purge failed:', err));
  }, 24 * 60 * 60 * 1000);
  handle.unref?.();
}
