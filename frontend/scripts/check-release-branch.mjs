// Keep production releases on the reviewed branch. Local/preview builds are unaffected.
if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF !== 'mvp-complete') {
  console.error('Production build blocked: configure the Vercel production branch as mvp-complete after baseline reconciliation.');
  process.exit(1);
}
