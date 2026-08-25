/** Soft blur gate: viewer must have verified Premium. Own media stays clear. */
export function discreetBlurForViewer(opts: {
  viewerIsPremium: boolean;
  isOwn: boolean;
  hasVisualMedia?: boolean;
}): boolean {
  if (opts.isOwn) return false;
  if (opts.hasVisualMedia === false) return false;
  return !opts.viewerIsPremium;
}
