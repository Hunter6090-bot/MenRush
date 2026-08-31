# MenRush Android Trusted Web Activity (Bubblewrap)

Package: `com.menrush.app`  
Host: `https://menrush.com` (start URL `/app`)  
Tooling: `@bubblewrap/cli`

## What this is

A Play-Store–ready TWA wrapper around the existing MenRush PWA. The web
manifest at `frontend/public/manifest.json` stays the source of truth for the
site; Bubblewrap reads it via `twa-manifest.json`.

## Digital Asset Links

Served from the site as:

`https://menrush.com/.well-known/assetlinks.json`

File in repo: `frontend/public/.well-known/assetlinks.json`

Fingerprint matches the upload keystore used to sign
`app-release-signed.apk`. When you enable **Google Play App Signing**, add
Play’s app-signing certificate SHA-256 to the same file (keep the upload
cert fingerprint too).

## Build (signed APK + AAB)

Prereqs: JDK 17, Android SDK (Bubblewrap can install them), Node 20+.

```bash
cd android
cp .signing.env.example .signing.env   # fill passwords (see team vault)
npm ci
npm run twa:update                     # regenerate project from twa-manifest.json
npm run twa:build                      # → app-release-signed.apk + app-release-bundle.aab
```

Or: `./scripts/build-twa.sh`

Upload `app-release-bundle.aab` to Play Console. Sideload
`app-release-signed.apk` for device QA.

## Signing

- Keystore path: `android/android.keystore` (alias `menrush`)
- Passwords: `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD`
  in `.signing.env` (gitignored). Never commit production secrets to a
  public fork.
- Back up the keystore. Every Play update must reuse it (or Play App Signing).

## Install banner (Android Chrome)

`InstallPrompt` shows on Android Chrome phones and:

1. Uses `beforeinstallprompt` when Chrome offers a PWA install, or
2. Opens the Play Store listing for the TWA (`com.menrush.app`) when the
   deferred prompt is not available.

`prefer_related_applications` stays `false` so Chrome can still fire
`beforeinstallprompt` for the web install path until the Play listing is
the primary distribution channel.
