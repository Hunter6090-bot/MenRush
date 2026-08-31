#!/usr/bin/env bash
# Rebuild MenRush TWA APK + AAB with Bubblewrap.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .signing.env ]]; then
  echo "Missing android/.signing.env — copy from .signing.env.example and fill passwords." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .signing.env
set +a

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.bubblewrap/android_sdk}"

if [[ ! -f android.keystore ]]; then
  echo "Missing android/android.keystore (upload signing key)." >&2
  exit 1
fi

npm ci
npx bubblewrap update --skipVersionUpgrade
npx bubblewrap build

echo "Built:"
ls -lh app-release-signed.apk app-release-bundle.aab
